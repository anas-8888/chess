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
const String ssid = "Adham";
const String password = "12345678";
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
    
    // تحديث الدور في FEN الجديد - الدور الحالي يصبح للاعب الآخر
    // هذا مهم جداً لضمان تزامن FEN مع الدور الصحيح
    String newTurn = (parts[1] == "w") ? "b" : "w";
    String newFen = np + " " + newTurn + " " + parts[2] + " " + parts[3] + " " + parts[4] + " " + parts[5];
    String fromSq = String(char('a'+fC)) + char('1'+fR);
    String toSq = String(char('a'+tC)) + char('1'+tR);
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
        
        // التحقق من أن الحركة صحيحة
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
            
        } else if ((rem == 1 && add == 1) || (rem == 1 && add == 0)) {
            // حركة صحيحة - إما نقل قطعة أو قتل قطعة
            String moveType = (add == 0) ? "CAPTURE" : "MOVE";
            Serial.println("🎯 " + moveType + " detected - rem: " + String(rem) + ", add: " + String(add));
            
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
                    
                    Serial.println("✅ Valid " + moveType + " - updated protected state");
                    
                    // تنبيه ضوئي للحركة الناجحة
                    digitalWrite(LED_PIN, HIGH);
                    delay(500);
                    digitalWrite(LED_PIN, LOW);
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
            Serial.println("📊 Move stats - rem: " + String(rem) + ", add: " + String(add));
            
            // استعادة oldBoard من النسخة المحمية
            memcpy(lastBoard, protectedOldBoard, sizeof(protectedOldBoard));
            currentFen = protectedOldFen;
            Serial.println("🛡️ Restored oldBoard - no valid move");
        }
    }
    
    lastBtn = btnNow;
    delay(10);
}