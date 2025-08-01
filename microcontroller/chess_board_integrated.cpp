#include <WiFi.h>
#include <WebSocketsClient.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>
#include <AccelStepper.h>
#include <cctype>
#include <string.h>
#include <math.h>

// Pin Definitions
const int SIG = 34;
const int S0 = 25, S1 = 33, S2 = 32, S3 = 13;
const int E0 = 26, E1 = 27, E2 = 14, E3 = 12;
const int BTN_PIN = 4;
const int LED_PIN = 2;

#define STEP_PIN_A   5
#define DIR_PIN_A    2
#define STEP_PIN_B   23
#define DIR_PIN_B    18
#define ENABLE_PIN   19
const int SERVO_PIN = 22;

// Connection Settings
const String ssid = "king";
const String password = "20002000moon555555";
const String host = "192.168.1.4";
const uint16_t port = 3000;
const int userId = 5;

// Global Variables
WebSocketsClient webSocket;
String currentFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
String gameId, playerColor = "white", currentTurn = "white", userToken;
String lastProcessedFen = currentFen; // متغير لتتبع آخر FEN تم معالجته
unsigned long lastServerUpdate = 0;
const unsigned long SERVER_UPDATE_INTERVAL = 2000;
unsigned long lastGameStatusCheck = 0;
const unsigned long GAME_STATUS_CHECK_INTERVAL = 10000; // كل 10 ثوان

bool boardState[8][8], lastBoard[8][8];
bool protectedOldBoard[8][8];
String protectedOldFen;
bool isBoardProtected = false;

AccelStepper motorA(AccelStepper::DRIVER, STEP_PIN_A, DIR_PIN_A);
AccelStepper motorB(AccelStepper::DRIVER, STEP_PIN_B, DIR_PIN_B);
Servo myServo;

// Grid & Motion Parameters
const float STEPS_PER_MM = 50.0f;
const float CELL_SIZE_MM = 5.29f;
const int ROWS = 8;
const int COLS = 10;          // 0 & 9 = capture cols
const float G0_MM = 1.5f * CELL_SIZE_MM;
const float G1_MM = 1.5f * CELL_SIZE_MM;

const float MIN_END_SPEED = 1100.0f;
const float MAX_END_SPEED = 1500.0f;
const float RAMP_TIME = 0.2f;

float colOffsets[COLS], halfCol[COLS];
const float halfRow = CELL_SIZE_MM * 0.5f;
const float MIN_DIST_STEPS = CELL_SIZE_MM * STEPS_PER_MM;
const float MAX_DIST_STEPS = sqrtf(ROWS*ROWS + COLS*COLS) * CELL_SIZE_MM * STEPS_PER_MM;

// Runtime State
long currentRow = 0, currentCol = 0;

struct MoveResult {
    String fromSq, toSq, san, newFen;
};

// Function Declarations
void scanBoard();
bool readReed(int mux, int ch);
void countDiffs(bool oldB[8][8], bool newB[8][8], int &rem, int &add);
MoveResult computeMove(bool oldB[8][8], bool newB[8][8], const String &oldFen);
bool validateChessMove(const String &fen, const String &fromSq, const String &toSq, const String &currentTurn);
void updateOldBoardFromFen(const String &fen);
bool getTokenAndGameId();
bool updateBoardStateFromServer();
void webSocketEvent(WStype_t type, uint8_t* payload, size_t length);
void printBoardArray(bool arr[8][8], const char* name);
void blinkLED(int n);
void executeOpponentMove(const String &prevFen, const String &currentFen);
void fenToBoard(const String &fen, char board[8][8]);
bool isValidMove(char board[8][8], int fromRow, int fromCol, int toRow, int toCol, const String &currentTurn);
void moveToCell(int row, int col);
void runSegment(float dx_mm, float dy_mm);
void parseFen(const String &fen, char board[8][8]);
bool isValidSquare(int row, int col);
bool isWhitePiece(char piece);
bool isBlackPiece(char piece);
bool isCurrentPlayerPiece(char piece, const String &currentTurn);
bool checkGameStatus();
void returnMotorsToHome();

// Sensor Functions
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

void countDiffs(bool oldB[8][8], bool newB[8][8], int &rem, int &add) {
    rem = add = 0;
    for (int r = 0; r < 8; r++) {
        for (int c = 0; c < 8; c++) {
            if (oldB[r][c] && !newB[r][c]) rem++;
            if (!oldB[r][c] && newB[r][c]) add++;
        }
    }
}

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
    int ri=0, si=0;
    for (int i=0; i<=parts[0].length(); i++) {
        if (i==parts[0].length() || parts[0][i]=='/') {
            fenRanks[ri++] = parts[0].substring(si, i);
            si = i+1;
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
            }
            if (!oldB[r][c] && newB[r][c]) {
                tR=r; tC=c;
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
    
    String newTurn = (parts[1] == "w") ? "b" : "w";
    String newFen = np + " " + newTurn + " " + parts[2] + " " + parts[3] + " " + parts[4] + " " + parts[5];
    String fromSq = String(char('a'+fC)) + String(fR+1);
    String toSq = String(char('a'+tC)) + String(tR+1);
    String san = (pc>='A'&&pc<='Z'&&pc!='P') ? String(pc)+toSq : toSq;
    
    return {fromSq,toSq,san,newFen};
}

bool validateChessMove(const String &fen, const String &fromSq, const String &toSq, const String &currentTurn) {
    char board[8][8];
    fenToBoard(fen, board);
    int fromCol = fromSq.charAt(0) - 'a';
    int fromRow = fromSq.charAt(1) - '1';
    int toCol = toSq.charAt(0) - 'a';
    int toRow = toSq.charAt(1) - '1';
    return isValidMove(board, fromRow, fromCol, toRow, toCol, currentTurn);
}

void updateOldBoardFromFen(const String &fen) {
    String parts[6];
    int idx = 0, start = 0;
    for (int i = 0; i <= fen.length() && idx < 6; i++) {
        if (i == fen.length() || fen[i] == ' ') {
            parts[idx++] = fen.substring(start, i);
            start = i + 1;
        }
    }
    
    String fenRanks[8];
    int ri = 0, si = 0;
    for (int i = 0; i <= parts[0].length(); i++) {
        if (i == parts[0].length() || parts[0][i] == '/') {
            fenRanks[ri++] = parts[0].substring(si, i);
            si = i + 1;
        }
    }
    
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
    
    for (int r = 0; r < 8; r++) {
        for (int c = 0; c < 8; c++) {
            lastBoard[r][c] = (board8[r][c] != '.');
        }
    }
    
    memcpy(protectedOldBoard, lastBoard, sizeof(lastBoard));
    protectedOldFen = fen;
    isBoardProtected = true;
}

// Communication Functions
bool getTokenAndGameId() {
    HTTPClient http;
    String url = "http://" + host + ":" + String(port) + "/api/users/" + String(userId) + "/token-and-game";
    
    http.begin(url);
    int httpCode = http.GET();
    
    if (httpCode == HTTP_CODE_OK) {
        String payload = http.getString();
        DynamicJsonDocument doc(1024);
        DeserializationError error = deserializeJson(doc, payload);
        
        if (!error && doc["success"] == true) {
            userToken = doc["data"]["token"].as<String>();
            gameId = doc["data"]["lastGameId"].as<String>();
            playerColor = doc["data"]["playerColor"].as<String>();
            http.end();
            return true;
        }
    }
    http.end();
    return false;
}

bool updateBoardStateFromServer() {
    if (gameId.length() == 0) return false;
    
    HTTPClient http;
    String url = "http://" + host + ":" + String(port) + "/api/game/" + gameId;
    
    http.begin(url);
    http.addHeader("Authorization", "Bearer " + userToken);
    int httpCode = http.GET();
    
    if (httpCode == HTTP_CODE_OK) {
        String payload = http.getString();
        DynamicJsonDocument doc(2048);
        DeserializationError error = deserializeJson(doc, payload);
        
        if (!error && doc["success"] == true) {
            String newFen = doc["data"]["currentFen"].as<String>();
            if (newFen.length() > 0) {
                currentFen = newFen;
                updateOldBoardFromFen(newFen);
            }
            
            String newTurn = doc["data"]["currentTurn"].as<String>();
            if (newTurn.length() > 0) {
                currentTurn = newTurn;
            }
            
            http.end();
            return true;
        }
    }
    http.end();
    return false;
}

void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
    if (type == WStype_CONNECTED) {
        Serial.println("🔌 TCP connected");
    } else if (type == WStype_DISCONNECTED) {
        Serial.println("❌ تم فصل الاتصال");
    } else if (type == WStype_TEXT) {
        String msg = String((char*)payload);
        
        if (msg.charAt(0)=='0') {
            webSocket.sendTXT("40/friends,{\"token\":\"" + userToken + "\"}");
            return;
        }
        
        if (msg.startsWith("40/friends")) {
            String j = "{\"gameId\":\"" + gameId + "\"}";
            webSocket.sendTXT("42/friends,[\"joinGameRoom\"," + j + "]");
            return;
        }
        
        // مراقبة تحديثات الحركة من WebSocket
        if (msg.indexOf("moveMade") != -1 || msg.indexOf("fen") != -1) {
            Serial.println("📡 WebSocket move update received");
            // تحديث FEN من السيرفر فوراً
            if (updateBoardStateFromServer()) {
                Serial.println("✅ FEN updated from WebSocket");
            }
            // إزالة updateCurrentTurn() - نعتمد على القيمة من السيرفر
        }
    }
}

// تم حذف دالة updateCurrentTurn() - نعتمد على القيمة من السيرفر

// Helper Functions
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

void blinkLED(int n) {
    for (int i = 0; i < n; ++i) {
        digitalWrite(LED_PIN, HIGH);
        delay(200);
        digitalWrite(LED_PIN, LOW);
        delay(200);
    }
}

void parseFen(const String &fen, char board[8][8]) {
    memset(board, '.', 64);
    int r = 0, c = 0;
    for (char ch : fen) {
        if (ch == ' ') break;
        if (ch == '/') {
            r++;
            c = 0;
            continue;
        }
        if (isdigit(ch)) c += ch - '0';
        else if (isalpha(ch)) {
            if (r < 8 && c < 8) board[r][c] = ch;
            c++;
        }
    }
}

// Motion Functions
void runSegment(float dx_mm, float dy_mm) {
    long sx = lroundf(dx_mm * STEPS_PER_MM);
    long sy = lroundf(dy_mm * STEPS_PER_MM);
    long startA = motorA.currentPosition();
    long startB = motorB.currentPosition();
    long tgtA = startA + sx + sy;
    long tgtB = startB + sx - sy;
    
    float dist = sqrtf(float(sx*sx + sy*sy));
    float norm = constrain((dist - MIN_DIST_STEPS) / (MAX_DIST_STEPS - MIN_DIST_STEPS), 0.0f, 1.0f);
    float endSp = MIN_END_SPEED + norm * (MAX_END_SPEED - MIN_END_SPEED);
    float accel = endSp / RAMP_TIME;
    motorA.setAcceleration(accel);
    motorB.setAcceleration(accel);
    motorA.setMaxSpeed(endSp);
    motorB.setMaxSpeed(endSp);
    motorA.moveTo(tgtA);
    motorB.moveTo(tgtB);
    motorA.enableOutputs();
    motorB.enableOutputs();
    
    // تحسين رسائل التشخيص
    Serial.println("🔧 Motor A: " + String(startA) + " -> " + String(tgtA) + " (steps: " + String(sx) + ")");
    Serial.println("🔧 Motor B: " + String(startB) + " -> " + String(tgtB) + " (steps: " + String(sy) + ")");
    Serial.println("🔧 Distance: " + String(dist) + "mm, Speed: " + String(endSp) + " steps/s");
    
    while (motorA.distanceToGo() != 0 || motorB.distanceToGo() != 0) {
        motorA.run();
        motorB.run();
    }
}

void moveToCell(int row, int col) {
    // إضافة فحص حدود الشبكة
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) {
        Serial.println("❌ Error: Invalid cell coordinates (" + String(row) + "," + String(col) + ")");
        Serial.println("Valid range: row [0-" + String(ROWS-1) + "], col [0-" + String(COLS-1) + "]");
        return;
    }
    
    float dx = (row - currentRow) * CELL_SIZE_MM;
    float dy = colOffsets[col] - colOffsets[currentCol];
    if (row == currentRow) {
        float vdir = (currentRow <= (ROWS-1)/2 ? +1.0f : -1.0f);
        runSegment(vdir * halfRow, 0);
        runSegment(0, dy);
        runSegment(-vdir * halfRow, 0);
        currentCol = col;
        return;
    }
    if (col == currentCol) {
        float hdir = (currentCol <= (COLS-1)/2 ? +1.0f : -1.0f);
        runSegment(0, hdir * halfCol[currentCol]);
        runSegment(dx, 0);
        runSegment(0, -hdir * halfCol[col]);
        currentRow = row;
        return;
    }
    float sx = (dx > 0 ? +1.0f : -1.0f);
    float sy = (dy > 0 ? +1.0f : -1.0f);
    float hxs = halfCol[currentCol], hxe = halfCol[col];
    float hys = halfRow, hye = halfRow;
    runSegment(0, sy * hxs);
    runSegment(sx * hys, 0);
    runSegment(0, dy - sy * (hxs + hxe));
    runSegment(dx - sx * (hys + hye), 0);
    runSegment(sx * hye, 0);
    runSegment(0, sy * hxe);
    currentRow = row;
    currentCol = col;
}

// Setup Function
void setup() {
    Serial.begin(115200);
    pinMode(LED_PIN, OUTPUT);
    delay(200);
    
    // Initialize Sensor Pins
    pinMode(S0, OUTPUT);
    pinMode(S1, OUTPUT);
    pinMode(S2, OUTPUT);
    pinMode(S3, OUTPUT);
    pinMode(E0, OUTPUT);
    digitalWrite(E0, HIGH);
    pinMode(E1, OUTPUT);
    digitalWrite(E1, HIGH);
    pinMode(E2, OUTPUT);
    digitalWrite(E2, HIGH);
    pinMode(E3, OUTPUT);
    digitalWrite(E3, HIGH);
    pinMode(SIG, INPUT);
    pinMode(BTN_PIN, INPUT_PULLUP);
    
    // Initialize Stepper Motor Pins
    pinMode(ENABLE_PIN, OUTPUT);
    digitalWrite(ENABLE_PIN, LOW);
    motorA.setEnablePin(ENABLE_PIN);
    motorB.setEnablePin(ENABLE_PIN);
    motorA.setPinsInverted(false, false, true);
    motorB.setPinsInverted(false, false, true);
    
    // Initialize Servo
    myServo.setPeriodHertz(50);
    myServo.attach(SERVO_PIN, 500, 2500);
    myServo.write(37); // RELEASE
    
    // Pre-compute column offsets
    colOffsets[0] = 0.0f;
    halfCol[0] = G0_MM * 0.5f;
    for (int i = 1; i < COLS; ++i) {
        if (i == 1) {
            colOffsets[i] = G0_MM;
            halfCol[i] = halfRow;
        } else if (i == COLS-1) {
            colOffsets[i] = colOffsets[i-1] + G1_MM;
            halfCol[i] = G1_MM * 0.5f;
        } else {
            colOffsets[i] = colOffsets[i-1] + CELL_SIZE_MM;
            halfCol[i] = halfRow;
        }
    }
    
    Serial.println("🚀 ESP32 Chess Board Starting...");
    
    WiFi.begin(ssid.c_str(), password.c_str());
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print('.');
    }
    Serial.println("\n✅ WiFi Connected!");
    
    if (!getTokenAndGameId()) {
        Serial.println("❌ Failed to get token and game ID. Restarting...");
        ESP.restart();
    }
    
    if (playerColor != "white" && playerColor != "black") {
        Serial.println("❌ Invalid player color from API: " + playerColor);
        ESP.restart();
    }
    
    webSocket.begin(host.c_str(), port, "/socket.io/?EIO=4&transport=websocket");
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(5000);
    
    updateBoardStateFromServer();
    
    scanBoard();
    memcpy(lastBoard, boardState, sizeof(boardState));
    
    memcpy(protectedOldBoard, lastBoard, sizeof(lastBoard));
    protectedOldFen = currentFen;
    isBoardProtected = true;
    
    Serial.println("✅ Board initialized and ready!");
    Serial.println("🤖 Opponent move monitoring activated!");
    Serial.println("📡 WebSocket monitoring activated!");
    blinkLED(3);
}

// Loop Function
void loop() {
    webSocket.loop();
    
    // إضافة معالجة انقطاع الاتصال
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("❌ WiFi disconnected, attempting to reconnect...");
        WiFi.reconnect();
        delay(1000);
        return;
    }
    
    // ==================== 1) أولاً: جلب آخر FEN من السيرفر ====================
    unsigned long currentTime = millis();
    if (currentTime - lastServerUpdate >= SERVER_UPDATE_INTERVAL) {
        String prevFen = currentFen; // حفظ FEN السابق للمقارنة
        
        if (updateBoardStateFromServer()) {
            Serial.println("✅ Server update successful");
            
            // تحديث FEN المعالج إذا تم تحديثه من السيرفر
            if (currentFen != prevFen) {
                lastProcessedFen = prevFen;  // جهّز lastProcessedFen للكشف
                Serial.println("🔄 FEN updated from server - ready for detection");
            }
        } else {
            Serial.println("❌ Server update failed");
        }
        lastServerUpdate = currentTime;
    }
    
    // ==================== 2) بعدها: كشف حركة الخصم وتشغيل المحركات مباشرة ====================
    if (currentFen != lastProcessedFen) {
        Serial.println("🤖 كشف حركة الخصم (أو حركة جديدة)");
        Serial.println("Last processed FEN: " + lastProcessedFen);
        Serial.println("Current FEN: " + currentFen);
        Serial.println("Current Turn: " + currentTurn);
        Serial.println("Player Color: " + playerColor);
        
        // تنفيذ حركة الخصم
        executeOpponentMove(lastProcessedFen, currentFen);
        
        // تحديث FEN المعالج
        lastProcessedFen = currentFen;
        Serial.println("✅ Move executed - FEN updated");
    }
    
    // ==================== 3) فحص حالة اللعبة كل 10 ثوان ====================
    if (currentTime - lastGameStatusCheck >= GAME_STATUS_CHECK_INTERVAL) {
        Serial.println("🔍 Checking game status...");
        if (checkGameStatus()) {
            Serial.println("🏁 Game has ended - motors returned to home");
        } else {
            Serial.println("✅ Game is still active");
        }
        lastGameStatusCheck = currentTime;
    }
    
    // كشف حركة اللاعب
    static bool lastBtn = HIGH;
    bool btnNow = digitalRead(BTN_PIN);
    
    if (lastBtn == HIGH && btnNow == LOW) {
        scanBoard();
        printBoardArray(lastBoard, "Old Board");
        printBoardArray(boardState, "New Board");
        Serial.println("Old FEN: " + currentFen);
        Serial.println("Current Turn: " + currentTurn);
        Serial.println("Player Color: " + playerColor);
        
        int rem, add;
        countDiffs(lastBoard, boardState, rem, add);
        
        if (rem > 1 || add > 1) {
            blinkLED(3);
            Serial.println("⚠️ Multiple pieces moved - invalid move");
            memcpy(lastBoard, protectedOldBoard, sizeof(protectedOldBoard));
            currentFen = protectedOldFen;
            
        } else if (rem == 1 && add == 1) {
            MoveResult mv = computeMove(lastBoard, boardState, currentFen);
            Serial.println("New FEN: " + mv.newFen);
            
            if (mv.fromSq.length()) {
                if (currentTurn != playerColor) {
                    Serial.println("⚠️ Not your turn!");
                    blinkLED(2);
                    memcpy(lastBoard, protectedOldBoard, sizeof(protectedOldBoard));
                    currentFen = protectedOldFen;
                    
                } else {
                    bool isMoveValid = validateChessMove(currentFen, mv.fromSq, mv.toSq, currentTurn);
                    
                    if (isMoveValid) {
                        currentFen = mv.newFen;
                        memcpy(lastBoard, boardState, sizeof(boardState));
                        
                        memcpy(protectedOldBoard, lastBoard, sizeof(lastBoard));
                        protectedOldFen = currentFen;
                        
                        String nextTurn = (currentTurn == "white") ? "black" : "white";
                        
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
                        
                        currentTurn = nextTurn;
                        Serial.println("✅ Valid chess move - sent to server");
                        
                        // مزامنة lastProcessedFen لمنع تنفيذ executeOpponentMove عن هذه الحركة
                        lastProcessedFen = currentFen;
                        
                        digitalWrite(LED_PIN, HIGH);
                        delay(500);
                        digitalWrite(LED_PIN, LOW);
                    } else {
                        Serial.println("❌ Invalid chess move - restoring protected state");
                        memcpy(lastBoard, protectedOldBoard, sizeof(protectedOldBoard));
                        currentFen = protectedOldFen;
                        blinkLED(3);
                    }
                }
            } else {
                Serial.println("⚠️ لم يتم الكشف عن حركة صالحة");
                memcpy(lastBoard, protectedOldBoard, sizeof(protectedOldBoard));
                currentFen = protectedOldFen;
            }
        } else {
            Serial.println("⚠️ No valid move detected");
            memcpy(lastBoard, protectedOldBoard, sizeof(protectedOldBoard));
            currentFen = protectedOldFen;
        }
    }
    
    lastBtn = btnNow;
    delay(10);
}

// Additional helper functions
void fenToBoard(const String &fen, char board[8][8]) {
    String parts[6];
    int idx = 0, start = 0;
    for (int i = 0; i <= fen.length() && idx < 6; i++) {
        if (i == fen.length() || fen[i] == ' ') {
            parts[idx++] = fen.substring(start, i);
            start = i + 1;
        }
    }
    
    String fenRanks[8];
    int ri = 0, si = 0;
    for (int i = 0; i <= parts[0].length(); i++) {
        if (i == parts[0].length() || parts[0][i] == '/') {
            fenRanks[ri++] = parts[0].substring(si, i);
            si = i + 1;
        }
    }
    
    for (int r = 0; r < 8; r++) {
        String rowFen = fenRanks[7 - r];
        int c = 0;
        for (char ch : rowFen) {
            if (isdigit(ch)) {
                int n = ch - '0';
                while (n--) board[r][c++] = '.';
            } else {
                board[r][c++] = ch;
            }
        }
    }
}

bool isValidSquare(int row, int col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
}

bool isWhitePiece(char piece) {
    return piece >= 'A' && piece <= 'Z';
}

bool isBlackPiece(char piece) {
    return piece >= 'a' && piece <= 'z';
}

bool isCurrentPlayerPiece(char piece, const String &currentTurn) {
    if (piece == '.') return false;
    if (currentTurn == "white") return (piece >= 'A' && piece <= 'Z');
    else return (piece >= 'a' && piece <= 'z');
}

bool isValidMove(char board[8][8], int fromRow, int fromCol, int toRow, int toCol, const String &currentTurn) {
    if (!isValidSquare(fromRow, fromCol) || !isValidSquare(toRow, toCol)) return false;
    char piece = board[fromRow][fromCol];
    char target = board[toRow][toCol];
    if (piece == '.') return false;
    if (!isCurrentPlayerPiece(piece, currentTurn)) return false;
    if (target != '.' && isCurrentPlayerPiece(target, currentTurn)) return false;
    
    char p = (piece >= 'a' && piece <= 'z') ? piece - 32 : piece;
    switch (p) {
        case 'P': {
            int dir = (currentTurn == "white") ? 1 : -1;
            int startRow = (currentTurn == "white") ? 1 : 6;
            if (fromCol == toCol && toRow - fromRow == dir && board[toRow][toCol] == '.') return true;
            if (fromCol == toCol && fromRow == startRow && toRow - fromRow == 2*dir && board[fromRow+dir][fromCol] == '.' && board[toRow][toCol] == '.') return true;
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

// دالة تنفيذ حركة الخصم
void executeOpponentMove(const String &prevFen, const String &currentFen) {
    char prevB[8][8], curB[8][8];
    parseFen(prevFen, prevB);
    parseFen(currentFen, curB);

    // البحث عن مربع البداية والنهاية
    int fr = -1, fc = -1, tr = -1, tc = -1;
    for (int r = 0; r < 8; ++r) {
        for (int c = 0; c < 8; ++c) {
            if (prevB[r][c] != '.' && curB[r][c] == '.') {
                fr = r; fc = c;
                Serial.println("🔍 Found removed piece at: (" + String(r) + "," + String(c) + ")");
            }
            if (prevB[r][c] != curB[r][c] && curB[r][c] != '.') {
                tr = r; tc = c;
                Serial.println("🔍 Found added piece at: (" + String(r) + "," + String(c) + ")");
            }
        }
    }

    // إضافة معالجة الأخطاء
    if (fr < 0 || tr < 0) {
        Serial.println("❌ Error: Could not determine move coordinates");
        Serial.println("Previous FEN: " + prevFen);
        Serial.println("Current FEN: " + currentFen);
        return;
    }
    
    // حفظ الإحداثيات الأصلية قبل الانعكاس
    int originalFr = fr, originalFc = fc, originalTr = tr, originalTc = tc;
    
    bool capture = (prevB[originalTr][originalTc] != '.');
    Serial.println("🎯 Move: (" + String(fr) + "," + String(fc) + ") -> (" + String(tr) + "," + String(tc) + ")");
    Serial.println("🎯 Capture: " + String(capture ? "YES" : "NO"));

    // انعكاس الإحداثيات من منظور الخصم إلى منظورنا
    fr = 7 - originalFr;
    fc = 7 - originalFc;
    tr = 7 - originalTr;
    tc = 7 - originalTc;
    Serial.println("🔄 After mirror: (" + String(fr) + "," + String(fc) + ") -> (" + String(tr) + "," + String(tc) + ")");

    // حساب إحداثيات الشبكة بعد الانعكاس
    int gFr = fr;
    int gFc = fc + 1;   // +1 offset for grid
    int gTr = tr;
    int gTc = tc + 1;

    if (capture) {
        bool whiteCap = isupper(prevB[originalTr][originalTc]);
        int scrapCol = whiteCap ? 0 : 9;
        Serial.println("🗑️ Capturing piece to scrap column: " + String(scrapCol));
        
        // 1) RELEASE → move to captured piece
        myServo.write(37);
        moveToCell(gTr, gTc);
        // 2) ENGAGE & wait
        myServo.write(0); 
        delay(300);
        // 3) move to scrap column while ENGAGED
        moveToCell(gTr, scrapCol);
        // 4) RELEASE & تأخير صغير
        myServo.write(37); 
        delay(300);
    }

    // Move active piece
    Serial.println("🤖 Moving piece from (" + String(gFr) + "," + String(gFc) + ") to (" + String(gTr) + "," + String(gTc) + ")");
    
    // 1) RELEASE → origin
    myServo.write(37);
    moveToCell(gFr, gFc);
    // 2) ENGAGE & wait
    myServo.write(0); 
    delay(300);
    // 3) move to destination while ENGAGED
    moveToCell(gTr, gTc);
    // 4) RELEASE & wait
    myServo.write(37); 
    delay(300);
    
    Serial.println("✅ Opponent move executed successfully!");
}

// دالة فحص حالة اللعبة
bool checkGameStatus() {
    if (gameId.length() == 0) return false;
    
    HTTPClient http;
    String url = "http://" + host + ":" + String(port) + "/api/game/" + gameId;
    
    http.begin(url);
    http.addHeader("Authorization", "Bearer " + userToken);
    int httpCode = http.GET();
    
    if (httpCode == HTTP_CODE_OK) {
        String payload = http.getString();
        DynamicJsonDocument doc(2048);
        DeserializationError error = deserializeJson(doc, payload);
        
        if (!error && doc["success"] == true) {
            String gameStatus = doc["data"]["status"].as<String>();
            http.end();
            
            if (gameStatus == "ended") {
                Serial.println("🏁 Game ended - returning motors to home position");
                returnMotorsToHome();
                return true;
            }
        }
    }
    http.end();
    return false;
}

// دالة إعادة الموتورات للموقع 0,0
void returnMotorsToHome() {
    Serial.println("🏠 Returning motors to home position (0,0)");
    
    // RELEASE servo
    myServo.write(45);
    delay(300);
    
    // Move to home position (0,0)
    moveToCell(0, 0);
    
    Serial.println("✅ Motors returned to home position");
    blinkLED(5); // إشارة بصرية أن اللعبة انتهت
}