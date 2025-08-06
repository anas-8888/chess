#include <WiFi.h>
#include <WebSocketsClient.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// --- Pin Definitions ---
const int SIG = 34;
const int S0 = 25;
const int S1 = 33;
const int S2 = 32;
const int S3 = 13;
const int E0 = 26;
const int E1 = 27;
const int E2 = 14;
const int E3 = 12;
const int BTN_PIN = 4; // زر لحظي
const int LED_PIN = 2; // LED للتنبيه

// --- Connection Settings ---
const String ssid = "king";
const String password = "20002000moon555555";
const String host = "192.168.204.221";
const uint16_t port = 3000;
const int userId = 5; // المستخدم الخامس دائماً

// --- Globals ---
WebSocketsClient webSocket;
bool boardState[8][8], lastBoard[8][8];
String currentFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
String gameId;
String playerColor = "white"; // دور اللاعب في اللعبة (أبيض دائماً)
String currentTurn = "white"; // الدور الحالي في اللعبة
String userToken; // توكن المستخدم من API
unsigned long lastServerUpdate = 0; // مؤقت لتحديث السيرفر كل ثانيتين
const unsigned long SERVER_UPDATE_INTERVAL = 2000; // ثانيتين

// متغيرات محمية للـ oldBoard و oldFen
bool protectedOldBoard[8][8]; // نسخة محمية من oldBoard
String protectedOldFen; // نسخة محمية من oldFen
bool isBoardProtected = false; // مؤشر لحماية الرقعة

// --- MoveResult struct ---
struct MoveResult {
    String fromSq, toSq, san, newFen;
};

// --- Chess Validation Functions ---
// دالة لتحويل FEN إلى مصفوفة القطع
void fenToBoard(const String &fen, char board[8][8]) {
    Serial.println("🔍 fenToBoard - Input FEN: " + fen);
    
    String parts[6];
    int idx = 0, start = 0;
    for (int i = 0; i <= fen.length() && idx < 6; i++) {
        if (i == fen.length() || fen[i] == ' ') {
            parts[idx++] = fen.substring(start, i);
            start = i + 1;
        }
    }
    
    Serial.println("🔍 FEN parts[0]: " + parts[0]);
    
    String fenRanks[8];
    {
        int ri = 0, si = 0;
        for (int i = 0; i <= parts[0].length(); i++) {
            if (i == parts[0].length() || parts[0][i] == '/') {
                fenRanks[ri++] = parts[0].substring(si, i);
                si = i + 1;
            }
        }
    }
    
    Serial.println("🔍 FEN Ranks:");
    for (int i = 0; i < 8; i++) {
        Serial.println("  Rank " + String(i) + ": " + fenRanks[i]);
    }
    
    for (int r = 0; r < 8; r++) {
        String rowFen = fenRanks[7 - r];
        Serial.println("🔍 Processing row " + String(r) + " (FEN rank " + String(7-r) + "): " + rowFen);
        int c = 0;
        for (char ch : rowFen) {
            if (isdigit(ch)) {
                int n = ch - '0';
                Serial.println("  Adding " + String(n) + " empty squares");
                while (n--) board[r][c++] = '.';
            } else {
                Serial.println("  Adding piece: " + String(ch));
                board[r][c++] = ch;
            }
        }
    }
    
    Serial.println("🔍 Final board:");
    for (int r = 7; r >= 0; r--) {
        String row = "";
        for (int c = 0; c < 8; c++) {
            row += String(board[r][c]) + " ";
        }
        Serial.println("  Row " + String(r) + ": " + row);
    }
}

// دالة للتحقق من أن المربع داخل الرقعة
bool isValidSquare(int row, int col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
}

// دالة للتحقق من لون القطعة
bool isWhitePiece(char piece) {
    return piece >= 'A' && piece <= 'Z';
}

bool isBlackPiece(char piece) {
    return piece >= 'a' && piece <= 'z';
}

// دالة للتحقق من أن القطعة تنتمي للاعب الحالي
bool isCurrentPlayerPiece(char piece, const String &currentTurn) {
    if (piece == '.') return false;
    if (currentTurn == "white") return (piece >= 'A' && piece <= 'Z');
    else return (piece >= 'a' && piece <= 'z');
}

// دالة للتحقق من حركة البيدق
bool isValidPawnMove(char board[8][8], int fromRow, int fromCol, int toRow, int toCol, const String &currentTurn) {
    int direction = (currentTurn == "white") ? 1 : -1; // الأبيض يتحرك للأعلى، الأسود للأسفل
    
    Serial.println("🔍 Pawn validation - Direction: " + String(direction));
    Serial.println("🔍 From: (" + String(fromRow) + "," + String(fromCol) + ") To: (" + String(toRow) + "," + String(toCol) + ")");
    
    // التحقق من الاتجاه الصحيح
    if (currentTurn == "white" && toRow <= fromRow) {
        Serial.println("❌ White pawn moving in wrong direction");
        return false;
    }
    if (currentTurn == "black" && toRow >= fromRow) {
        Serial.println("❌ Black pawn moving in wrong direction");
        return false;
    }
    
    int rowDiff = toRow - fromRow;
    int colDiff = abs(toCol - fromCol);
    
    Serial.println("🔍 RowDiff: " + String(rowDiff) + ", ColDiff: " + String(colDiff));
    
    // حركة أمامية
    if (colDiff == 0) {
        Serial.println("🔍 Forward pawn move");
        // حركة واحدة للأمام
        if (rowDiff == direction && board[toRow][toCol] == '.') {
            Serial.println("✅ Single pawn move is valid");
            return true;
        } else {
            Serial.println("❌ Single pawn move invalid - RowDiff: " + String(rowDiff) + ", Direction: " + String(direction) + ", Target: " + String(board[toRow][toCol]));
        }
        // حركة مزدوجة من المربع الأولي
        if (rowDiff == 2 * direction) {
            Serial.println("🔍 Double pawn move detected");
            Serial.println("🔍 Checking initial position - White fromRow==6: " + String(fromRow == 6) + ", Black fromRow==1: " + String(fromRow == 1));
            if ((currentTurn == "white" && fromRow == 6) || (currentTurn == "black" && fromRow == 1)) {
                Serial.println("🔍 Initial position check passed");
                Serial.println("🔍 Checking path - Middle square: " + String(board[fromRow + direction][fromCol]) + ", Target square: " + String(board[toRow][toCol]));
                if (board[fromRow + direction][fromCol] == '.' && board[toRow][toCol] == '.') {
                    Serial.println("✅ Double pawn move is valid");
                    return true;
                } else {
                    Serial.println("❌ Path blocked for double pawn move");
                }
            } else {
                Serial.println("❌ Not initial position for double pawn move");
            }
        }
    }
    // حركة قطرية (أكل)
    else if (colDiff == 1 && rowDiff == direction) {
        if (board[toRow][toCol] != '.' && !isCurrentPlayerPiece(board[toRow][toCol], currentTurn)) {
            return true;
        }
    }
    
    Serial.println("❌ No valid pawn move pattern found");
    return false;
}

// دالة للتحقق من حركة الحصان
bool isValidKnightMove(int fromRow, int fromCol, int toRow, int toCol) {
    int rowDiff = abs(toRow - fromRow);
    int colDiff = abs(toCol - fromCol);
    return (rowDiff == 2 && colDiff == 1) || (rowDiff == 1 && colDiff == 2);
}

// دالة للتحقق من حركة الفيل
bool isValidBishopMove(char board[8][8], int fromRow, int fromCol, int toRow, int toCol) {
    int rowDiff = toRow - fromRow;
    int colDiff = toCol - fromCol;
    
    if (abs(rowDiff) != abs(colDiff)) return false;
    
    int rowStep = (rowDiff > 0) ? 1 : -1;
    int colStep = (colDiff > 0) ? 1 : -1;
    
    // التحقق من عدم وجود قطع في الطريق
    int r = fromRow + rowStep;
    int c = fromCol + colStep;
    while (r != toRow && c != toCol) {
        if (board[r][c] != '.') return false;
        r += rowStep;
        c += colStep;
    }
    
    return true;
}

// دالة للتحقق من حركة الطابية
bool isValidRookMove(char board[8][8], int fromRow, int fromCol, int toRow, int toCol) {
    if (fromRow != toRow && fromCol != toCol) return false;
    
    int rowStep = (fromRow == toRow) ? 0 : ((toRow > fromRow) ? 1 : -1);
    int colStep = (fromCol == toCol) ? 0 : ((toCol > fromCol) ? 1 : -1);
    
    // التحقق من عدم وجود قطع في الطريق
    int r = fromRow + rowStep;
    int c = fromCol + colStep;
    while (r != toRow || c != toCol) {
        if (board[r][c] != '.') return false;
        r += rowStep;
        c += colStep;
    }
    
    return true;
}

// دالة للتحقق من حركة الوزير
bool isValidQueenMove(char board[8][8], int fromRow, int fromCol, int toRow, int toCol) {
    return isValidBishopMove(board, fromRow, fromCol, toRow, toCol) ||
           isValidRookMove(board, fromRow, fromCol, toRow, toCol);
}

// دالة للتحقق من حركة الملك
bool isValidKingMove(int fromRow, int fromCol, int toRow, int toCol) {
    int rowDiff = abs(toRow - fromRow);
    int colDiff = abs(toCol - fromCol);
    return rowDiff <= 1 && colDiff <= 1;
}

// دالة للتحقق من صحة الحركة لأي قطعة
bool isValidMove(char board[8][8], int fromRow, int fromCol, int toRow, int toCol, const String &currentTurn) {
    if (!isValidSquare(fromRow, fromCol) || !isValidSquare(toRow, toCol)) return false;
    char piece = board[fromRow][fromCol];
    char target = board[toRow][toCol];
    if (piece == '.') return false;
    if (!isCurrentPlayerPiece(piece, currentTurn)) return false;
    if (target != '.' && isCurrentPlayerPiece(target, currentTurn)) return false;
    char p = (piece >= 'a' && piece <= 'z') ? piece - 32 : piece; // حولها لحرف كبير
    switch (p) {
        case 'P': {
            int dir = (currentTurn == "white") ? 1 : -1;
            int startRow = (currentTurn == "white") ? 1 : 6;
            // خطوة واحدة للأمام
            if (fromCol == toCol && toRow - fromRow == dir && board[toRow][toCol] == '.') return true;
            // خطوتين من الصف الأول
            if (fromCol == toCol && fromRow == startRow && toRow - fromRow == 2*dir && board[fromRow+dir][fromCol] == '.' && board[toRow][toCol] == '.') return true;
            // أكل قطري
            if (abs(toCol - fromCol) == 1 && toRow - fromRow == dir && board[toRow][toCol] != '.' && !isCurrentPlayerPiece(board[toRow][toCol], currentTurn)) return true;
        return false;
    }
        case 'N': {
            int dr = abs(toRow - fromRow), dc = abs(toCol - fromCol);
            return (dr == 2 && dc == 1) || (dr == 1 && dc == 2);
        }
        case 'B': {
            int dr = toRow - fromRow, dc = toCol - fromCol;
            if (abs(dr) != abs(dc)) return false;
            int rStep = (dr > 0) ? 1 : -1, cStep = (dc > 0) ? 1 : -1;
            for (int r = fromRow + rStep, c = fromCol + cStep; r != toRow; r += rStep, c += cStep)
                if (board[r][c] != '.') return false;
            return true;
        }
        case 'R': {
            if (fromRow != toRow && fromCol != toCol) return false;
            int rStep = (toRow == fromRow) ? 0 : ((toRow > fromRow) ? 1 : -1);
            int cStep = (toCol == fromCol) ? 0 : ((toCol > fromCol) ? 1 : -1);
            for (int r = fromRow + rStep, c = fromCol + cStep; r != toRow || c != toCol; r += rStep, c += cStep)
                if (board[r][c] != '.') return false;
            return true;
        }
        case 'Q': {
            // ملكة = فيل أو طابية
            int dr = toRow - fromRow, dc = toCol - fromCol;
            if (abs(dr) == abs(dc)) {
                int rStep = (dr > 0) ? 1 : -1, cStep = (dc > 0) ? 1 : -1;
                for (int r = fromRow + rStep, c = fromCol + cStep; r != toRow; r += rStep, c += cStep)
                    if (board[r][c] != '.') return false;
                return true;
            } else if (fromRow == toRow || fromCol == toCol) {
                int rStep = (toRow == fromRow) ? 0 : ((toRow > fromRow) ? 1 : -1);
                int cStep = (toCol == fromCol) ? 0 : ((toCol > fromCol) ? 1 : -1);
                for (int r = fromRow + rStep, c = fromCol + cStep; r != toRow || c != toCol; r += rStep, c += cStep)
                    if (board[r][c] != '.') return false;
                return true;
            }
                return false;
            }
        case 'K': {
            int dr = abs(toRow - fromRow), dc = abs(toCol - fromCol);
            return dr <= 1 && dc <= 1;
        }
        default:
            return false;
    }
}

// دالة التحقق الشاملة
bool validateChessMove(const String &fen, const String &fromSq, const String &toSq, const String &currentTurn) {
    char board[8][8];
    fenToBoard(fen, board);
    // تحويل الإحداثيات: الصف 0 هو الأسفل (1 في الشطرنج)، الصف 7 هو الأعلى (8 في الشطرنج)
    int fromCol = fromSq.charAt(0) - 'a';
    int fromRow = fromSq.charAt(1) - '1';
    int toCol = toSq.charAt(0) - 'a';
    int toRow = toSq.charAt(1) - '1';
    return isValidMove(board, fromRow, fromCol, toRow, toCol, currentTurn);
}

// --- Helpers ---
void printBoardArray(bool arr[8][8], const char* name) {
    Serial.printf("=== %s ===\n", name);
    for (int r = 7; r >= 0; r--) {
        for (int c = 7; c >= 0; c--) {
            Serial.print(arr[r][c] ? '1' : '0');
            Serial.print(' ');
        }
        Serial.println();
    }
    Serial.println("==============");
}

bool readReed(int mux, int ch) {
    const int E_pins[4] = { E0, E1, E2, E3 };
    for (int i = 0; i < 4; i++) digitalWrite(E_pins[i], HIGH);
    digitalWrite(E_pins[mux], LOW);
    digitalWrite(S0, (ch >> 0) & 1);
    digitalWrite(S1, (ch >> 1) & 1);
    digitalWrite(S2, (ch >> 2) & 1);
    digitalWrite(S3, (ch >> 3) & 1);
    delayMicroseconds(100);
    bool closed = digitalRead(SIG) == LOW;
    digitalWrite(E_pins[mux], HIGH);
    return closed;
}

void scanBoard() {
    for (int mux = 0; mux < 4; mux++) {
        int base = mux * 2;
        for (int ch = 0; ch < 16; ch++) {
            boardState[ch % 8][base + (ch < 8 ? 0 : 1)] = readReed(mux, ch);
        }
    }
}

// يحسب عدد الإزالات والإضافات بين old و new
void countDiffs(bool oldB[8][8], bool newB[8][8], int &rem, int &add) {
    rem = add = 0;
    for (int r = 0; r < 8; r++) {
        for (int c = 0; c < 8; c++) {
            if (oldB[r][c] && !newB[r][c]) rem++;
            if (!oldB[r][c] && newB[r][c]) add++;
        }
    }
}

// --- Compute move & new FEN ---
MoveResult computeMove(bool oldB[8][8], bool newB[8][8], const String &oldFen) {
    String parts[6];
    int idx=0, start=0;
    for (int i=0; i<=oldFen.length() && idx<6; i++) {
        if (i==oldFen.length() || oldFen[i]==' ') {
            parts[idx++] = oldFen.substring(start, i);
            start = i+1;
        }
    }
    
    String fenRanks[8];
    {
        int ri=0, si=0;
        for (int i=0; i<=parts[0].length(); i++) {
            if (i==parts[0].length() || parts[0][i]=='/') {
                fenRanks[ri++] = parts[0].substring(si, i);
                si = i+1;
            }
        }
    }
    
    char board8[8][8];
    for (int r=0; r<8; r++) {
        String rowFen = fenRanks[7-r];
        int c=0;
        for (char ch: rowFen) {
            if (isdigit(ch)) {
                int n=ch-'0';
                while(n--) board8[r][c++]='.';
            } else board8[r][c++] = ch;
        }
    }
    
    int fR=-1,fC=-1,tR=-1,tC=-1;
    for (int r=0; r<8; r++)
        for (int c=0; c<8; c++) {
            if (oldB[r][c] && !newB[r][c]) {
                fR=r; fC=c;
                Serial.println("🔍 Found removed piece at: (" + String(r) + "," + String(c) + ")");
            }
            if (!oldB[r][c] && newB[r][c]) {
                tR=r; tC=c;
                Serial.println("🔍 Found added piece at: (" + String(r) + "," + String(c) + ")");
            }
        }
    
    if (fR<0||tR<0) return {"","","",""};
    
    char pc = board8[fR][fC];
    board8[fR][fC]='.';
    board8[tR][tC]=pc;
    
    String np;
    for (int rank=7; rank>=0; rank--) {
        int e=0;
        for (int col=0; col<8; col++) {
            char x = board8[rank][col];
            if (x=='.') e++;
            else {
                if(e){np+=String(e); e=0;}
                np+=x;
            }
        }
        if (e) np+=String(e);
        if (rank) np+='/';
    }
    
    // تحديث الدور في FEN الجديد - الدور الحالي يصبح للاعب الآخر
    // هذا مهم جداً لضمان تزامن FEN مع الدور الصحيح
    String newTurn = (parts[1] == "w") ? "b" : "w";
    String newFen = np + " " + newTurn + " " + parts[2] + " " + parts[3] + " " + parts[4] + " " + parts[5];
    // تصحيح تحويل الإحداثيات - الصف 0 في المصفوفة = الصف 1 في الشطرنج
    String fromSq = String(char('a'+fC)) + String(fR+1);
    String toSq = String(char('a'+tC)) + String(tR+1);
    
    // إضافة تشخيص مفصل
    Serial.println("🔍 computeMove - fR: " + String(fR) + ", fC: " + String(fC) + " -> fromSq: " + fromSq);
    Serial.println("🔍 computeMove - tR: " + String(tR) + ", tC: " + String(tC) + " -> toSq: " + toSq);
    String san = (pc>='A'&&pc<='Z'&&pc!='P') ? String(pc)+toSq : toSq;
    
    return {fromSq,toSq,san,newFen};
}

// تحديث الدور الحالي
void updateCurrentTurn() {
    currentTurn = (currentTurn == "white") ? "black" : "white";
}

// دالة للحصول على التوكن ورقم اللعبة من API
bool getTokenAndGameId() {
    HTTPClient http;
    String url = "http://" + host + ":" + String(port) + "/api/users/" + String(userId) + "/token-and-game";
    
    Serial.println("🔗 Connecting to API: " + url);
    
    http.begin(url);
    int httpCode = http.GET();
    
    if (httpCode == HTTP_CODE_OK) {
        String payload = http.getString();
        Serial.println("📨 API Response: " + payload);
        
        // تحليل JSON
        DynamicJsonDocument doc(1024);
        DeserializationError error = deserializeJson(doc, payload);
        
        if (error) {
            Serial.println("❌ JSON parsing failed: " + String(error.c_str()));
            http.end();
            return false;
        }
        
        if (doc["success"] == true) {
            userToken = doc["data"]["token"].as<String>();
            gameId = doc["data"]["lastGameId"].as<String>();
            playerColor = doc["data"]["playerColor"].as<String>();
            
            Serial.println("✅ Token: " + userToken);
            Serial.println("✅ Game ID: " + gameId);
            Serial.println("✅ Player Color: " + playerColor);
            
            http.end();
            return true;
        } else {
            Serial.println("❌ API returned error: " + doc["message"].as<String>());
            http.end();
            return false;
        }
    } else {
        Serial.println("❌ HTTP request failed, code: " + String(httpCode));
        http.end();
        return false;
    }
}

// دالة لتحديث حالة الرقعة من السيرفر
bool updateBoardStateFromServer() {
    if (gameId.length() == 0) {
        Serial.println("❌ No game ID available");
        return false;
    }
    
    HTTPClient http;
    String url = "http://" + host + ":" + String(port) + "/api/game/" + gameId;
    
    Serial.println("🔄 Updating board state from server: " + url);
    
    http.begin(url);
    http.addHeader("Authorization", "Bearer " + userToken);
    int httpCode = http.GET();
    
    if (httpCode == HTTP_CODE_OK) {
        String payload = http.getString();
        Serial.println("📨 Server Response: " + payload);
        
        // تحليل JSON
        DynamicJsonDocument doc(2048);
        DeserializationError error = deserializeJson(doc, payload);
        
        if (error) {
            Serial.println("❌ JSON parsing failed: " + String(error.c_str()));
            http.end();
            return false;
        }
        
        if (doc["success"] == true) {
            // تحديث FEN الحالي - دائماً تحديث حتى لو لم يتغير
            String newFen = doc["data"]["currentFen"].as<String>();
            if (newFen.length() > 0) {
                Serial.println("🔄 Updating FEN from server: " + newFen);
                currentFen = newFen;
                
                // تحديث oldBoard بناءً على FEN الجديد - دائماً
                updateOldBoardFromFen(newFen);
            }
            
            // تحديث الدور الحالي - دائماً تحديث
            String newTurn = doc["data"]["currentTurn"].as<String>();
            if (newTurn.length() > 0) {
                Serial.println("🔄 Updating turn from server: " + newTurn);
                currentTurn = newTurn;
            }
            
            http.end();
            return true;
        } else {
            Serial.println("❌ Server returned error: " + doc["message"].as<String>());
            http.end();
            return false;
        }
    } else {
        Serial.println("❌ HTTP request failed, code: " + String(httpCode));
        http.end();
        return false;
    }
}

// دالة لتحويل FEN إلى مصفوفة 8×8 وتحديث oldBoard
void updateOldBoardFromFen(const String &fen) {
    // تقسيم FEN إلى أجزاء
    String parts[6];
    int idx = 0, start = 0;
    for (int i = 0; i <= fen.length() && idx < 6; i++) {
        if (i == fen.length() || fen[i] == ' ') {
            parts[idx++] = fen.substring(start, i);
            start = i + 1;
        }
    }
    
    // تحليل رتب FEN
    String fenRanks[8];
    {
        int ri = 0, si = 0;
        for (int i = 0; i <= parts[0].length(); i++) {
            if (i == parts[0].length() || parts[0][i] == '/') {
                fenRanks[ri++] = parts[0].substring(si, i);
                si = i + 1;
            }
        }
    }
    
    // تحويل FEN إلى مصفوفة 8×8
    char board8[8][8];
    for (int r = 0; r < 8; r++) {
        String rowFen = fenRanks[7 - r];
        int c = 0;
        for (char ch : rowFen) {
            if (isdigit(ch)) {
                int n = ch - '0';
                while (n--) board8[r][c++] = '.';
            } else {
                board8[r][c++] = ch;
            }
        }
    }
    
    // تحويل المصفوفة إلى oldBoard (true = قطعة موجودة، false = مربع فارغ)
    for (int r = 0; r < 8; r++) {
        for (int c = 0; c < 8; c++) {
            // أي حرف غير '.' يعني وجود قطعة
            lastBoard[r][c] = (board8[r][c] != '.');
        }
    }
    
    // تحديث النسخ المحمية فقط عند التحديث من السيرفر
    memcpy(protectedOldBoard, lastBoard, sizeof(lastBoard));
    protectedOldFen = fen;
    isBoardProtected = true;
    
    Serial.println("🔄 Updated oldBoard from server FEN: " + fen);
    Serial.println("🔄 Current FEN: " + currentFen);
    Serial.println("🔄 Current Turn: " + currentTurn);
    Serial.println("🛡️ Board state protected from invalid moves");
    printBoardArray(lastBoard, "Updated Old Board");
}

// --- WebSocket / Socket.IO handler ---
void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
    if (type == WStype_CONNECTED) {
        Serial.println("🔌 TCP connected");
    } else if (type == WStype_DISCONNECTED) {
        Serial.println("❌ تم فصل الاتصال");
    } else if (type == WStype_TEXT) {
        String msg = String((char*)payload);
        
        if (msg.charAt(0)=='0') {
            Serial.println("🔄 engine.io handshake");
            webSocket.sendTXT("40/friends,{\"token\":\"" + userToken + "\"}");
            return;
        }
        
        if (msg.startsWith("40/friends")) {
            Serial.println("✅ namespace /friends ready");
            String j = "{\"gameId\":\"" + gameId + "\"}";
            webSocket.sendTXT("42/friends,[\"joinGameRoom\"," + j + "]");
            Serial.println("🎮 Joined game room: " + gameId);
            return;
        }
        
        // معالجة أحداث الحركة من السيرفر
        if (msg.indexOf("moveMade") != -1) {
            Serial.println("📨 Received moveMade event from server");
            // تحديث الدور الحالي بناءً على الحركة المستلمة
            updateCurrentTurn();
        }
        
        // معالجة تحديثات المؤقت
        if (msg.indexOf("clockUpdate") != -1) {
            Serial.println("⏰ Received clock update from server");
        }
        
        // معالجة تحديثات الدور
        if (msg.indexOf("turnUpdate") != -1) {
            Serial.println("🔄 Received turn update from server");
        }
        
        Serial.printf("📨 %s\n", payload);
    }
}

void setup() {
    Serial.begin(115200);
    pinMode(LED_PIN, OUTPUT);
    delay(200);
    
    pinMode(S0,OUTPUT);
    pinMode(S1,OUTPUT);
    pinMode(S2,OUTPUT);
    pinMode(S3,OUTPUT);
    pinMode(E0,OUTPUT);
    digitalWrite(E0,HIGH);
    pinMode(E1,OUTPUT);
    digitalWrite(E1,HIGH);
    pinMode(E2,OUTPUT);
    digitalWrite(E2,HIGH);
    pinMode(E3,OUTPUT);
    digitalWrite(E3,HIGH);
    pinMode(SIG,INPUT);
    pinMode(BTN_PIN,INPUT_PULLUP);
    
    Serial.println("🚀 ESP32 Chess Board Starting...");
    Serial.println("📡 Connecting to WiFi: " + ssid);
    
    WiFi.begin(ssid.c_str(), password.c_str());
    while (WiFi.status()!=WL_CONNECTED) {
        delay(500);
        Serial.print('.');
    }
    Serial.println("\n✅ WiFi Connected! IP=" + WiFi.localIP().toString());
    
    // الحصول على التوكن ورقم اللعبة من API
    Serial.println("🔑 Getting token and game ID from API...");
    if (!getTokenAndGameId()) {
        Serial.println("❌ Failed to get token and game ID. Restarting...");
        ESP.restart();
    }
    
    // التحقق من صحة دور اللاعب
    if (playerColor != "white" && playerColor != "black") {
        Serial.println("❌ Invalid player color from API: " + playerColor);
        Serial.println("🔄 Restarting...");
        ESP.restart();
    }
    
    Serial.println("✅ Player color set to: " + playerColor);
    Serial.println("✅ Game ID: " + gameId);
    
    // الاتصال بـ WebSocket
    Serial.println("🔌 Connecting to WebSocket server...");
    webSocket.begin(host.c_str(), port, "/socket.io/?EIO=4&transport=websocket");
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(5000);
    
    // تحديث oldBoard من السيرفر عند بدء التشغيل
    Serial.println("🔄 Initializing oldBoard from server...");
    updateBoardStateFromServer();
    
    scanBoard();
    memcpy(lastBoard, boardState, sizeof(boardState));
    
    // تهيئة النسخ المحمية
    memcpy(protectedOldBoard, lastBoard, sizeof(lastBoard));
    protectedOldFen = currentFen;
    isBoardProtected = true;
    
    Serial.println("✅ Board initialized and ready!");
    Serial.println("🛡️ Board state protection enabled");
    
    // تنبيه ضوئي للاستعداد
    for (int i=0; i<3; i++) {
        digitalWrite(LED_PIN, HIGH);
        delay(200);
        digitalWrite(LED_PIN, LOW);
        delay(200);
    }
}

void loop() {
    webSocket.loop();
    
    // تحديث حالة الرقعة من السيرفر كل ثانيتين
    unsigned long currentTime = millis();
    if (currentTime - lastServerUpdate >= SERVER_UPDATE_INTERVAL) {
        Serial.println("⏰ Time to update from server (every 2 seconds)");
        if (updateBoardStateFromServer()) {
            Serial.println("✅ Server update successful");
        } else {
            Serial.println("❌ Server update failed");
        }
        lastServerUpdate = currentTime;
    }
    
    static bool lastBtn = HIGH;
    bool btnNow = digitalRead(BTN_PIN);
    
    if (lastBtn==HIGH && btnNow==LOW) {
        scanBoard();
        printBoardArray(lastBoard, "Old Board");
        printBoardArray(boardState, "New Board");
        Serial.println("Old FEN: " + currentFen);
        Serial.println("Current Turn: " + currentTurn);
        Serial.println("Player Color: " + playerColor);
        
        int rem, add;
        countDiffs(lastBoard, boardState, rem, add);
        
        // التحقق من أن الحركة صحيحة (فقط قطعة واحدة تم تحريكها)
        if (rem > 1 || add > 1) {
            // تنبيه ضوئي للحركة غير الصحيحة
            for (int i=0; i<3; i++) {
                digitalWrite(LED_PIN, HIGH);
                delay(200);
                digitalWrite(LED_PIN, LOW);
                delay(200);
            }
            Serial.println("⚠️ Multiple pieces moved - invalid move");
            Serial.println("🛡️ Keeping protected oldBoard unchanged");
            
            // استعادة oldBoard من النسخة المحمية
            memcpy(lastBoard, protectedOldBoard, sizeof(protectedOldBoard));
            currentFen = protectedOldFen;
            Serial.println("🔄 Restored oldBoard from protected state");
            
        } else if (rem == 1 && add == 1) {
            // حركة صحيحة - قطعة واحدة تم تحريكها
            MoveResult mv = computeMove(lastBoard, boardState, currentFen);
            Serial.println("New FEN: " + mv.newFen);
            
            if (mv.fromSq.length()) {
                // التحقق من أن اللاعب يلعب في دوره
                if (currentTurn != playerColor) {
                    Serial.println("⚠️ Not your turn! Current turn: " + currentTurn + ", Your color: " + playerColor);
                    // تنبيه ضوئي
                    for (int i=0; i<2; i++) {
                        digitalWrite(LED_PIN, HIGH);
                        delay(100);
                        digitalWrite(LED_PIN, LOW);
                        delay(100);
                    }
                    
                    // استعادة oldBoard من النسخة المحمية
                    memcpy(lastBoard, protectedOldBoard, sizeof(protectedOldBoard));
                    currentFen = protectedOldFen;
                    Serial.println("🛡️ Restored oldBoard - not your turn");
                    
                } else {
                    // فحص صحة الحركة قبل الإرسال
                    bool isMoveValid = validateChessMove(currentFen, mv.fromSq, mv.toSq, currentTurn);
                    
                    if (isMoveValid) {
                        // تحديث حالة الرقعة المحلية - فقط عند الحركة الصحيحة
                        currentFen = mv.newFen;
                        memcpy(lastBoard, boardState, sizeof(boardState));
                        
                        // تحديث النسخ المحمية عند الحركة الصحيحة
                        memcpy(protectedOldBoard, lastBoard, sizeof(lastBoard));
                        protectedOldFen = currentFen;
                        
                        // تحديث الدور للدور التالي
                        String nextTurn = (currentTurn == "white") ? "black" : "white";
                        
                        // إرسال الحركة مع جميع البيانات المطلوبة
                        String p = "{\"gameId\":\""+gameId+"\","+
                                   "\"from\":\"" + mv.fromSq +"\","+
                                   "\"to\":\""   + mv.toSq   +"\","+
                                   "\"san\":\""  + mv.san    +"\","+
                                   "\"fen\":\""  + mv.newFen +"\","+
                                   "\"movedBy\":\"" + playerColor +"\","+
                                   "\"currentTurn\":\"" + nextTurn +"\"}";
                        
                        String frame="42/friends,[\"move\","+p+"]";
                        webSocket.sendTXT(frame);
                        Serial.println("➡️ " + frame);
                        
                        // تحديث الدور المحلي
                        currentTurn = nextTurn;
                        
                        Serial.println("✅ Valid chess move - sent to server");
                        
                        // تنبيه ضوئي للحركة الناجحة
                        digitalWrite(LED_PIN, HIGH);
                        delay(500);
                        digitalWrite(LED_PIN, LOW);
                    } else {
                        // الحركة غير صحيحة - استعادة الحالة المحمية
                        Serial.println("❌ Invalid chess move - restoring protected state");
                        memcpy(lastBoard, protectedOldBoard, sizeof(protectedOldBoard));
                        currentFen = protectedOldFen;
                        
                        // تنبيه ضوئي للحركة غير الصحيحة
                        for (int i=0; i<3; i++) {
                            digitalWrite(LED_PIN, HIGH);
                            delay(200);
                            digitalWrite(LED_PIN, LOW);
                            delay(200);
                        }
                    }
                }
            } else {
                Serial.println("⚠️ لم يتم الكشف عن حركة صالحة");
                
                // استعادة oldBoard من النسخة المحمية
                memcpy(lastBoard, protectedOldBoard, sizeof(protectedOldBoard));
                currentFen = protectedOldFen;
                Serial.println("🛡️ Restored oldBoard - invalid move pattern");
            }
        } else {
            Serial.println("⚠️ No valid move detected - no pieces moved or invalid pattern");
            
            // استعادة oldBoard من النسخة المحمية
            memcpy(lastBoard, protectedOldBoard, sizeof(protectedOldBoard));
            currentFen = protectedOldFen;
            Serial.println("🛡️ Restored oldBoard - no valid move");
        }
    }
    
    lastBtn = btnNow;
    delay(10);
}