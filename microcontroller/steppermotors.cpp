#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>
#include <AccelStepper.h>
#include <math.h>
#include <ctype.h>

/**************** Wi‑Fi credentials ****************/
const char* SSID     = "king";
const char* PASSWORD = "20002000moon555555";

/**************** Pin definitions ******************/
#define STEP_PIN_A   5
#define DIR_PIN_A    2
#define STEP_PIN_B   23
#define DIR_PIN_B    18
#define ENABLE_PIN   19
const int SERVO_PIN = 22;
const int LED_PIN   = 15;

/**************** Objects ***************************/
AccelStepper motorA(AccelStepper::DRIVER, STEP_PIN_A, DIR_PIN_A);
AccelStepper motorB(AccelStepper::DRIVER, STEP_PIN_B, DIR_PIN_B);
Servo        myServo;

/**************** Grid + motion params (طبقاً للكود الميكانيكي الأصلي) ******/
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

/**************** Runtime state *********************/
bool   stage1Complete = false;
int    lastGameId     = -1;
String prevFen        = "";
long   currentRow     = 0, currentCol = 0;

/**************** Forward decls ********************/
void runSegment(float dx_mm, float dy_mm);
void moveToCell(int row, int col);

/**************** Helpers ***************************/
void blinkLED(int n){ for(int i=0;i<n;++i){ digitalWrite(LED_PIN,HIGH); delay(200); digitalWrite(LED_PIN,LOW); delay(200);} }

void parseFen(const String &fen,char board[8][8]){
  memset(board,'.',64);
  int r=0,c=0;
  for(char ch: fen){
    if(ch==' ') break;
    if(ch=='/') { r++; c=0; continue; }
    if(isdigit(ch)) c += ch-'0';
    else if(isalpha(ch)){ if(r<8 && c<8) board[r][c]=ch; c++; }
  }
}

/**************** SETUP *****************************/
void setup(){
  Serial.begin(115200);
  pinMode(LED_PIN,OUTPUT);

  // Wi‑Fi
  WiFi.begin(SSID,PASSWORD);
  Serial.print("📶 Connecting");
  while(WiFi.status()!=WL_CONNECTED){ Serial.print('.'); delay(500);}  
  Serial.println(" connected");

  // Servo
  myServo.setPeriodHertz(50);
  myServo.attach(SERVO_PIN,500,2500);
  myServo.write(37);                        // RELEASE

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

  Serial.println("✅ Ready");
}

/**************** LOOP ******************************/
void loop(){
  /* —— مرحلة ١ —— */
  if(!stage1Complete){
    HTTPClient http;
    http.begin("http://192.168.204.221:3000/api/users/5/token-and-game");
    int code=http.GET();
    if(code==HTTP_CODE_OK){
      DynamicJsonDocument doc(4096);
      if(deserializeJson(doc,http.getStream())==DeserializationError::Ok && doc["success"]){
        String status=doc["data"]["lastGameStatus"]|"";
        String method=doc["data"]["playerPlayMethod"]|"";
        lastGameId = doc["data"]["lastGameId"] | -1;
        if(status=="active" && method=="physical_board"){ stage1Complete=true; blinkLED(5);} }
    }
    http.end(); delay(5000); return; }

  /* —— مرحلة ٢ —— */
  if (motorA.distanceToGo() == 0 && motorB.distanceToGo() == 0) {
    String url = "http://192.168.204.221:3000/api/game/" + String(lastGameId);
    HTTPClient http; 
    http.begin(url);
    int code = http.GET();
    if (code == HTTP_CODE_OK) {
        DynamicJsonDocument doc(4096);
        if (deserializeJson(doc, http.getStream()) == DeserializationError::Ok && doc["success"]) {
            String currFen = doc["data"]["currentFen"] | "";
            if (prevFen.length() && currFen != prevFen) {
                char prevB[8][8], curB[8][8];
                parseFen(prevFen, prevB);
                parseFen(currFen, curB);

                int fr = -1, fc = -1, tr = -1, tc = -1;
                for (int r = 0; r < 8; ++r) {
                    for (int c = 0; c < 8; ++c) {
                        if (prevB[r][c] != '.' && curB[r][c] == '.') {
                            fr = r; fc = c;
                        }
                        if (prevB[r][c] != curB[r][c] && curB[r][c] != '.') {
                            tr = r; tc = c;
                        }
                    }
                }

                if (fr >= 0 && tr >= 0) {
                    bool capture = (prevB[tr][tc] != '.');

                    // ——— انعكاس الإحداثيات من منظور الخصم إلى منظورنا ———
                    fr = 7 - fr;
                    fc = 7 - fc;
                    tr = 7 - tr;
                    tc = 7 - tc;

                    // —— حساب إحداثيات الشبكة بعد الانعكاس ——
                    int gFr = fr;
                    int gFc = fc + 1;   // +1 offset for grid
                    int gTr = tr;
                    int gTc = tc + 1;

                    if (capture) {
                        bool whiteCap = isupper(prevB[tr][tc]);
                        int scrapCol = whiteCap ? 0 : 9;
                        // 1) RELEASE → move to captured piece
                        myServo.write(37);
                        moveToCell(gTr, gTc);
                        // 2) ENGAGE & wait
                        myServo.write(0); delay(300);
                        // 3) move to scrap column while ENGAGED
                        moveToCell(gTr, scrapCol);
                        // 4) RELEASE & تأخير صغير
                        myServo.write(37); delay(300);
                    }

                    // ——— Move active piece ———
                    // 1) RELEASE → origin
                    myServo.write(37);
                    moveToCell(gFr, gFc);
                    // 2) ENGAGE & wait
                    myServo.write(0); delay(300);
                    // 3) move to destination while ENGAGED
                    moveToCell(gTr, gTc);
                    // 4) RELEASE & wait
                    myServo.write(37); delay(300);
                }
            }
            prevFen = currFen;
        }
    }
    http.end();
    delay(2000);
  }
}

/**************** Motion primitives *********/
void runSegment(float dx_mm,float dy_mm){
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

void moveToCell(int row,int col){
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
