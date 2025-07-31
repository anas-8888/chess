#include <WiFi.h>
#include <WebSocketsClient.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>
#include <AccelStepper.h>
#include <math.h>
#include <ctype.h>
#include <math.h>
#include <ctype.h>

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

// --- Stepper Motor Pins ---
#define STEP_PIN_A   5
#define DIR_PIN_A    2
#define STEP_PIN_B   23
#define DIR_PIN_B    18
#define ENABLE_PIN   19
const int SERVO_PIN = 22;
#define STEP_PIN_A   5
#define DIR_PIN_A    2
#define STEP_PIN_B   23
#define DIR_PIN_B    18
#define ENABLE_PIN   19
const int SERVO_PIN = 22;

// --- Connection Settings ---
const String ssid = "king";
const String password = "20002000moon555555";
const String host = "192.168.1.10";
const uint16_t port = 3000;
const int userId = 5; // المستخدم الخامس دائماً

// --- Grid + motion params ---
const float STEPS_PER_MM = 50.0f;
const float CELL_SIZE_MM = 5.29f;
const int   ROWS         = 8;
const int   COLS         = 10;          // 0 & 9 = capture cols
const float G0_MM        = 1.5f * CELL_SIZE_MM;
const float G1_MM        = 1.5f * CELL_SIZE_MM;

const float MIN_END_SPEED = 1100.0f;
const float MAX_END_SPEED = 1500.0f;
const float RAMP_TIME     = 0.2f;

float colOffsets[COLS], halfCol[COLS];
const float halfRow = CELL_SIZE_MM * 0.5f;
const float MIN_DIST_STEPS = CELL_SIZE_MM * STEPS_PER_MM;
const float MAX_DIST_STEPS = sqrtf(ROWS*ROWS + COLS*COLS) * CELL_SIZE_MM * STEPS_PER_MM;

// --- Globals ---
WebSocketsClient webSocket;
AccelStepper motorA(AccelStepper::DRIVER, STEP_PIN_A, DIR_PIN_A);
AccelStepper motorB(AccelStepper::DRIVER, STEP_PIN_B, DIR_PIN_B);
Servo        myServo;

bool boardState[8][8], lastBoard[8][8];
String currentFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
String gameId;
String playerColor = "white"; // دور اللاعب في اللعبة
String currentTurn = "white"; // الدور الحالي في اللعبة
String userToken; // توكن المستخدم من API

// --- Runtime state ---
bool stage1Complete = false;
long currentRow = 0, currentCol = 0;
bool isProcessingMove = false; // منع الحركات المتعددة
bool moveInProgress = false; // حركة قيد التنفيذ

// --- MoveResult struct ---
struct MoveResult {
    String fromSq, toSq, san, newFen;
};

// --- Helpers ---
void blinkLED(int n) { 
    for(int i=0; i<n; ++i) { 
        digitalWrite(LED_PIN, HIGH); 
        delay(200); 
        digitalWrite(LED_PIN, LOW); 
        delay(200);
    } 
}

void parseFen(const String &fen, char board[8][8]) {
    memset(board, '.', 64);
    int r=0, c=0;
    for(char ch: fen) {
        if(ch==' ') break;
        if(ch=='/') { r++; c=0; continue; }
        if(isdigit(ch)) c += ch-'0';
        else if(isalpha(ch)) { if(r<8 && c<8) board[r][c]=ch; c++; }
    }
}

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

// --- Motion primitives ---
void runSegment(float dx_mm, float dy_mm) {
    long sx=lroundf(dx_mm*STEPS_PER_MM);
    long sy=lroundf(dy_mm*STEPS_PER_MM);
    long startA=motorA.currentPosition();
    long startB=motorB.currentPosition();
    long tgtA=startA+sx+sy;
    long tgtB=startB+sx-sy;
    float dist=sqrtf(float(sx*sx+sy*sy));
    float norm=constrain((dist-MIN_DIST_STEPS)/(MAX_DIST_STEPS-MIN_DIST_STEPS),0.0f,1.0f);
    float endSp=MIN_END_SPEED+norm*(MAX_END_SPEED-MIN_END_SPEED);
    float accel=endSp/RAMP_TIME;
    motorA.setAcceleration(accel); motorB.setAcceleration(accel);
    motorA.setMaxSpeed(endSp);     motorB.setMaxSpeed(endSp);
    motorA.moveTo(tgtA); motorB.moveTo(tgtB);
    motorA.enableOutputs(); motorB.enableOutputs();
    while(motorA.distanceToGo()!=0 || motorB.distanceToGo()!=0){ motorA.run(); motorB.run(); }
}

void moveToCell(int row, int col) {
    float dx=(row-currentRow)*CELL_SIZE_MM;
    float dy=colOffsets[col]-colOffsets[currentCol];
    if(row==currentRow){
        float vdir=(currentRow<=(ROWS-1)/2?+1.0f:-1.0f);
        runSegment(vdir*halfRow,0); runSegment(0,dy); runSegment(-vdir*halfRow,0);
        currentCol=col; return; }
    if(col==currentCol){
        float hdir=(currentCol<=(COLS-1)/2?+1.0f:-1.0f);
        runSegment(0,hdir*halfCol[currentCol]); runSegment(dx,0); runSegment(0,-hdir*halfCol[col]);
        currentRow=row; return; }
    float sx=(dx>0?+1.0f:-1.0f);
    float sy=(dy>0?+1.0f:-1.0f);
    float hxs=halfCol[currentCol], hxe=halfCol[col];
    float hys=halfRow, hye=halfRow;
    runSegment(0,sy*hxs);
    runSegment(sx*hys,0);
    runSegment(0,dy-sy*(hxs+hxe));
    runSegment(dx-sx*(hys+hye),0);
    runSegment(sx*hye,0);
    runSegment(0,sy*hxe);
    currentRow=row; currentCol=col;
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
            String status = doc["data"]["lastGameStatus"] | "";
            String method = doc["data"]["playerPlayMethod"] | "";
            
            // التحقق من أن اللعبة نشطة وأن الطريقة هي physical_board
            if (status != "active" || method != "physical_board") {
                Serial.println("❌ Game is not active or not physical_board method");
                Serial.println("Status: " + status + ", Method: " + method);
                http.end();
                return false;
            }
            
            userToken = doc["data"]["token"].as<String>();
            gameId = doc["data"]["lastGameId"].as<String>();
            playerColor = doc["data"]["playerColor"].as<String>();
            
            Serial.println("✅ Token: " + userToken);
            Serial.println("✅ Game ID: " + gameId);
            Serial.println("✅ Player Color: " + playerColor);
            Serial.println("✅ Game Status: " + status);
            Serial.println("✅ Play Method: " + method);
            
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

// دالة لجلب currentFen من API
bool getCurrentFenFromAPI() {
    if (gameId.length() == 0) {
        Serial.println("❌ No game ID available");
        return false;
    }
    
    HTTPClient http;
    String url = "http://" + host + ":" + String(port) + "/api/game/" + gameId;
    
    Serial.println("🔗 Getting current FEN from API: " + url);
    
    http.begin(url);
    int httpCode = http.GET();
    
    if (httpCode == HTTP_CODE_OK) {
        String payload = http.getString();
        Serial.println("📨 FEN API Response: " + payload);
        
        // تحليل JSON
        DynamicJsonDocument doc(4096);
        DeserializationError error = deserializeJson(doc, payload);
        
        if (error) {
            Serial.println("❌ JSON parsing failed: " + String(error.c_str()));
            http.end();
            return false;
        }
        
        if (doc["success"] == true) {
            String newFen = doc["data"]["currentFen"] | "";
            if (newFen.length() > 0) {
                currentFen = newFen;
                Serial.println("✅ Updated currentFen: " + currentFen);
                http.end();
                return true;
            } else {
                Serial.println("❌ No FEN in response");
                http.end();
                return false;
            }
        } else {
            Serial.println("❌ FEN API returned error: " + doc["message"].as<String>());
            http.end();
            return false;
        }
    } else {
        Serial.println("❌ FEN HTTP request failed, code: " + String(httpCode));
        http.end();
        return false;
    }
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
            // تحديث currentFen من API
            getCurrentFenFromAPI();
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
    
    // إعداد الحساسات
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
    
    // إعداد المحركات
    myServo.setPeriodHertz(50);
    myServo.attach(SERVO_PIN,500,2500);
    myServo.write(50);                        // RELEASE

    // Steppers (always enabled)
    pinMode(ENABLE_PIN,OUTPUT);
    digitalWrite(ENABLE_PIN,LOW);
    motorA.setEnablePin(ENABLE_PIN);
    motorB.setEnablePin(ENABLE_PIN);
    motorA.setPinsInverted(false,false,true);
    motorB.setPinsInverted(false,false,true);

    // Pre‑compute column offsets
    colOffsets[0] = 0.0f;  halfCol[0] = G0_MM*0.5f;
    for(int i=1;i<COLS;++i){
        if(i==1){ colOffsets[i]=G0_MM; halfCol[i]=halfRow; }
        else if(i==COLS-1){ colOffsets[i]=colOffsets[i-1]+G1_MM; halfCol[i]=G1_MM*0.5f; }
        else { colOffsets[i]=colOffsets[i-1]+CELL_SIZE_MM; halfCol[i]=halfRow; }
    }
    
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
    
    // جلب currentFen من API
    if (!getCurrentFenFromAPI()) {
        Serial.println("❌ Failed to get current FEN. Restarting...");
        ESP.restart();
    }
    
    // الاتصال بـ WebSocket
    Serial.println("🔌 Connecting to WebSocket server...");
    webSocket.begin(host.c_str(), port, "/socket.io/?EIO=4&transport=websocket");
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(5000);
    
    scanBoard();
    memcpy(lastBoard, boardState, sizeof(boardState));
    Serial.println("✅ Board initialized and ready!");
    
    // تنبيه ضوئي للاستعداد
    blinkLED(3);
}

void loop() {
    webSocket.loop();
    
    static bool lastBtn = HIGH;
    bool btnNow = digitalRead(BTN_PIN);
    
    // منع الحركات المتعددة
    if (isProcessingMove || moveInProgress) {
        return;
    }
    
    if (lastBtn==HIGH && btnNow==LOW) {
        // التحقق من أن اللاعب يلعب في دوره
        if (currentTurn != playerColor) {
            Serial.println("⚠️ Not your turn! Current turn: " + currentTurn + ", Your color: " + playerColor);
            // تنبيه ضوئي
            blinkLED(2);
            return;
        }
        
        isProcessingMove = true;
        digitalWrite(LED_PIN, HIGH); // إشارة بدء المعالجة
        
        scanBoard();
        printBoardArray(lastBoard, "Old Board");
        printBoardArray(boardState, "New Board");
        Serial.println("Old FEN: " + currentFen);
        Serial.println("Current Turn: " + currentTurn);
        Serial.println("Player Color: " + playerColor);
        
        int rem, add;
        countDiffs(lastBoard, boardState, rem, add);
        
        if (rem>1 || add>1) {
            // تنبيه ضوئي للحركة غير الصحيحة
            blinkLED(3);
            Serial.println("⚠️ Multiple pieces moved - invalid move");
            isProcessingMove = false;
            digitalWrite(LED_PIN, LOW);
        } else {
            MoveResult mv = computeMove(lastBoard, boardState, currentFen);
            Serial.println("New FEN: " + mv.newFen);
            
            if (mv.fromSq.length()) {
                // تحديث currentFen فقط بعد حركة صحيحة
                currentFen = mv.newFen;
                memcpy(lastBoard, boardState, sizeof(boardState));
                
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
                
                // تنبيه ضوئي للحركة الناجحة
                digitalWrite(LED_PIN, LOW);
                delay(100);
                digitalWrite(LED_PIN, HIGH);
                delay(500);
                digitalWrite(LED_PIN, LOW);
                
                Serial.println("✅ Move completed successfully");
            } else {
                Serial.println("⚠️ لم يتم الكشف عن حركة صالحة");
                blinkLED(2);
            }
            
            isProcessingMove = false;
        }
    }
    
    lastBtn = btnNow;
    delay(10);
}