    #include <WiFi.h>
    #include <WiFiClientSecure.h>
    #include <WebSocketsClient.h>
    #include <HTTPClient.h>
    #include <ArduinoJson.h>
    #include <ESP32Servo.h>
    #include <AccelStepper.h>
    #include <cctype>
    #include <string.h>
    #include <math.h>
    #include <utility>

    // Pin Definitions
    const int SIG = 34;
    const int S0 = 25, S1 = 33, S2 = 32, S3 = 13;
    const int E0 = 26, E1 = 27, E2 = 14, E3 = 12;
    const int BTN_PIN = 4;
    const int LED_PIN = 16;
    const int RESIGN_PIN = 15; // زر الاستسلام - يمكن تغييره حسب الحاجة

    #define STEP_PIN_A   5
    #define DIR_PIN_A    2
    #define STEP_PIN_B   23
    #define DIR_PIN_B    18
    #define ENABLE_PIN   19
    const int SERVO_PIN = 22;
    const int SERVO_ENGAGE_ANGLE = 0;
    const int SERVO_RELEASE_ANGLE = 90;
    const int SERVO_RELEASE_HOME_ANGLE = 20;
    const int SERVO_MIN_SAFE_ANGLE = 0;
    const int SERVO_MAX_SAFE_ANGLE = 20;
    const int SERVO_STEP_DELAY_MS = 0;

    // Connection Settings
    const String ssid = "Nexa Group";
    const String password = "123zx123";
    const String host = "192.168.1.23";   // local IP (used when DEPLOY_DOMAIN is empty)
    const uint16_t port = 3003;            // local port (used when DEPLOY_DOMAIN is empty)
    const int userId = 1;

    // --- Deployment: fill DEPLOY_DOMAIN to switch to hosted server, leave empty for local ---
    const String   DEPLOY_DOMAIN   = "";        // e.g. "api.yourapp.com"
    const uint16_t DEPLOY_WS_PORT  = 443;       // 443 for wss, 80 for ws
    const bool     DEPLOY_USE_TLS  = true;      // true = https/wss

    // Global Variables
    WebSocketsClient webSocket;
    String currentFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    String gameId, playerColor = "white", currentTurn = "white", userToken;
    String lastProcessedFen = currentFen; // متغير لتتبع آخر FEN تم معالجته
    unsigned long lastServerUpdate = 0;
    const unsigned long SERVER_UPDATE_INTERVAL = 15000; // كل 15 ثانية - WebSocket يتولى التحديث الفوري
    unsigned long lastGameStatusCheck = 0;
    const unsigned long GAME_STATUS_CHECK_INTERVAL = 20000; // كل 20 ثانية (WS يتولى الأحداث الفورية)
    unsigned long lastNewGamePoll = 0;
    const unsigned long NEW_GAME_POLL_INTERVAL = 3000; // كل 3 ثوان أثناء انتظار لعبة جديدة
    bool skipServerSync = false; // منع التزامن مع السيرفر مؤقتاً
    int serverSyncSkipCount = 0; // عداد لتخطي التزامن
    const int SERVER_SYNC_SKIP_CYCLES = 1; // تقليل فترة حماية التزامن لتسريع الاستجابة
    bool hasResigned = false; // علم الاستسلام للانتقال للعبة الجديدة
    bool isFetchingNewGame = false; // منع فحص حالة اللعبة أثناء انتظار المباراة الجديدة
    bool wsConnected = false; // تتبع حالة اتصال WebSocket
    String lastEndedGameId = "";
    volatile bool opponentMovePending = false; // علامة سريعة: WS وصل حركة خصم جديدة
    unsigned long lastSensorBroadcast = 0;
    const unsigned long SENSOR_BROADCAST_INTERVAL_MS = 120;

    // Interrupt-based button detection — captures press even during HTTP blocking calls
    volatile bool btnPressedFlag = false;
    volatile bool resignPressedFlag = false;

    void IRAM_ATTR onBtnPress()    { btnPressedFlag    = true; }
    void IRAM_ATTR onResignPress() { resignPressedFlag = true; }

    bool boardState[8][8], lastBoard[8][8];
    bool protectedOldBoard[8][8];
    String protectedOldFen;
    bool isBoardProtected = false;
    bool baselineBoard[8][8] = {}; // squares active on empty board (false positives to ignore)

    AccelStepper motorA(AccelStepper::DRIVER, STEP_PIN_A, DIR_PIN_A);
    AccelStepper motorB(AccelStepper::DRIVER, STEP_PIN_B, DIR_PIN_B);
    Servo myServo;
    int currentServoAngle = SERVO_RELEASE_ANGLE;
    bool servoAngleInitialized = false;

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

    enum BoardTransform : uint8_t {
        MAP_IDENTITY = 0,      // sensor(r,c) -> chess(r,c)
        MAP_MIRROR_ROWS = 1,   // sensor(r,c) -> chess(7-r,c)
        MAP_MIRROR_COLS = 2,   // sensor(r,c) -> chess(r,7-c)
        MAP_MIRROR_BOTH = 3    // sensor(r,c) -> chess(7-r,7-c)
    };

    // Lock board sensor mapping to avoid symmetric ambiguities.
    // Confirmed by serial log: sensor row 0 = rank 1 (white side) — rows are NOT inverted.
    // sensor col 0 = h-file (white's RIGHT) — only columns are inverted.
    // MAP_MIRROR_COLS: sensor(r,c) → chess(r, 7-c) — sensor col 0 → h-file (col 7).
    const BoardTransform LOCKED_SENSOR_MAP = MAP_MIRROR_COLS;

    // Function Declarations
    String getServerBaseUrl();
    void   connectWebSocket();
    void scanBoard();
    void scanBoardTo(bool outBoard[8][8]);
    bool scanBoardStable(bool outBoard[8][8], int samples, int gapMs);
    bool readReed(int mux, int ch);
    void countDiffs(bool oldB[8][8], bool newB[8][8], int &rem, int &add);
    void logBoardDiffDetails(bool oldB[8][8], bool newB[8][8]);
    MoveResult computeMove(bool oldB[8][8], bool newB[8][8], const String &oldFen);
    bool validateChessMove(const String &fen, const String &fromSq, const String &toSq, const String &currentTurn);
    void updateOldBoardFromFen(const String &fen);
    bool getTokenAndGameId();
    bool updateBoardStateFromServer();
    void webSocketEvent(WStype_t type, uint8_t* payload, size_t length);
    void printBoardArray(bool arr[8][8], const char* name);
    void blinkLED(int n);
    void executeOpponentMove(const String &prevFen, const String &currentFen);
    void sendBoardSensorUpdate();
    void calibrateEmptyBoard();
    void moveServoSmooth(int targetAngle, int stepDelayMs = SERVO_STEP_DELAY_MS);
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
    void handleCapture(int r, int c);
    bool fetchLastActiveGame();
    bool submitMoveHTTP(const String &fromSq, const String &toSq, const String &san, const String &fen);
    void joinCurrentGameRoom();
    // Returns (r,c) of any removed piece between prevFen and currentFen, or (-1,-1) if none.
    std::pair<int,int> findCaptureFromFen(const String& prevFen, const String& currentFen);
    String normalizeFenForBoard(const String &fen);
    String sensorToSquare(int sensorRow, int sensorCol, BoardTransform transform);
    String buildFenAfterMove(const String &oldFen, const String &fromSq, const String &toSq);
    String buildSimpleSan(const String &oldFen, const String &fromSq, const String &toSq, bool isCapture);
    bool inferMoveTransform(
        bool oldB[8][8],
        bool newB[8][8],
        const String &oldFen,
        const String &turn,
        bool isCapture,
        MoveResult &outMove,
        BoardTransform &outTransform
    );

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

    void scanBoardTo(bool outBoard[8][8]) {
        for (int mux = 0; mux < 4; mux++) {
            int base = mux * 2;
            for (int ch = 0; ch < 16; ch++) {
                outBoard[ch % 8][base + (ch < 8 ? 0 : 1)] = readReed(mux, ch);
            }
        }
    }

    void scanBoard() {
        scanBoardTo(boardState);
    }

    bool scanBoardStable(bool outBoard[8][8], int samples, int gapMs) {
        int votes[8][8];
        memset(votes, 0, sizeof(votes));
        bool sampleBoard[8][8];

        for (int i = 0; i < samples; i++) {
            scanBoardTo(sampleBoard);
            for (int r = 0; r < 8; r++) {
                for (int c = 0; c < 8; c++) {
                    if (sampleBoard[r][c]) votes[r][c]++;
                }
            }
            if (gapMs > 0) delay(gapMs);
        }

        // Use a stricter threshold for squares that appear NEW (currently empty in lastBoard)
        // to filter out transient magnetic coupling from a moving piece's magnet.
        // Squares that were already occupied use the normal majority vote.
        int normalThreshold = (samples / 2) + 1;       // e.g. 4/7
        int strictThreshold = (samples * 3 / 4) + 1;   // e.g. 6/7 — for "appeared" squares
        for (int r = 0; r < 8; r++) {
            for (int c = 0; c < 8; c++) {
                bool wasOccupied = lastBoard[r][c];
                int thr = wasOccupied ? normalThreshold : strictThreshold;
                outBoard[r][c] = (votes[r][c] >= thr);
            }
        }
        return true;
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

    void logBoardDiffDetails(bool oldB[8][8], bool newB[8][8]) {
        Serial.println("🔎 Changed squares detail (sensor + approx chess):");
        for (int r = 0; r < 8; r++) {
            for (int c = 0; c < 8; c++) {
                if (oldB[r][c] == newB[r][c]) continue;
                String approxSq = String(char('a' + c)) + String(r + 1);
                Serial.println(
                    "   r=" + String(r) +
                    ", c=" + String(c) +
                    " (" + approxSq + ")" +
                    ": " + String(oldB[r][c] ? 1 : 0) +
                    " -> " + String(newB[r][c] ? 1 : 0)
                );
            }
        }
    }

    String normalizeFenForBoard(const String &fen) {
        String trimmed = fen;
        trimmed.trim();
        if (trimmed == "startpos") {
            return "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
        }
        return trimmed;
    }

    String sensorToSquare(int sensorRow, int sensorCol, BoardTransform transform) {
        int rr = sensorRow;
        int cc = sensorCol;
        if (transform == MAP_MIRROR_ROWS || transform == MAP_MIRROR_BOTH) rr = 7 - rr;
        if (transform == MAP_MIRROR_COLS || transform == MAP_MIRROR_BOTH) cc = 7 - cc;

        if (rr < 0 || rr > 7 || cc < 0 || cc > 7) return "";
        return String(char('a' + cc)) + String(rr + 1);
    }

    String buildFenAfterMove(const String &oldFen, const String &fromSq, const String &toSq) {
        String normalizedFen = normalizeFenForBoard(oldFen);
        String parts[6] = {"", "", "", "", "", ""};
        int idx = 0, start = 0;
        for (int i = 0; i <= normalizedFen.length() && idx < 6; i++) {
            if (i == normalizedFen.length() || normalizedFen[i] == ' ') {
                parts[idx++] = normalizedFen.substring(start, i);
                start = i + 1;
            }
        }
        if (idx < 6) return normalizedFen;

        char board[8][8];
        fenToBoard(normalizedFen, board);
        int fromCol = fromSq.charAt(0) - 'a';
        int fromRow = fromSq.charAt(1) - '1';
        int toCol = toSq.charAt(0) - 'a';
        int toRow = toSq.charAt(1) - '1';
        if (!isValidSquare(fromRow, fromCol) || !isValidSquare(toRow, toCol)) return normalizedFen;

        char movingPiece = board[fromRow][fromCol];
        if (movingPiece == '.') return normalizedFen;
        board[fromRow][fromCol] = '.';
        board[toRow][toCol] = movingPiece;

        String boardPart = "";
        for (int rank = 7; rank >= 0; rank--) {
            int empty = 0;
            for (int col = 0; col < 8; col++) {
                char piece = board[rank][col];
                if (piece == '.') {
                    empty++;
                } else {
                    if (empty > 0) {
                        boardPart += String(empty);
                        empty = 0;
                    }
                    boardPart += piece;
                }
            }
            if (empty > 0) boardPart += String(empty);
            if (rank > 0) boardPart += "/";
        }

        String nextTurn = (parts[1] == "w") ? "b" : "w";
        return boardPart + " " + nextTurn + " " + parts[2] + " " + parts[3] + " " + parts[4] + " " + parts[5];
    }

    String buildSimpleSan(const String &oldFen, const String &fromSq, const String &toSq, bool isCapture) {
        char board[8][8];
        fenToBoard(normalizeFenForBoard(oldFen), board);
        int fromCol = fromSq.charAt(0) - 'a';
        int fromRow = fromSq.charAt(1) - '1';
        if (!isValidSquare(fromRow, fromCol)) return toSq;
        char piece = board[fromRow][fromCol];
        if (piece == '.') return toSq;

        char upper = (piece >= 'a' && piece <= 'z') ? piece - 32 : piece;
        if (upper == 'P') {
            return isCapture ? (String(fromSq.charAt(0)) + "x" + toSq) : toSq;
        }
        return String(upper) + (isCapture ? String("x") : String("")) + toSq;
    }

    MoveResult computeMove(bool oldB[8][8], bool newB[8][8], const String &oldFen) {
        String normalizedFen = normalizeFenForBoard(oldFen);
        String parts[6];
        int idx=0, start=0;
        for (int i=0; i<=normalizedFen.length() && idx<6; i++) {
            if (i==normalizedFen.length() || normalizedFen[i]==' ') {
                parts[idx++] = normalizedFen.substring(start, i);
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

    bool inferMoveTransform(
        bool oldB[8][8],
        bool newB[8][8],
        const String &oldFen,
        const String &turn,
        bool isCapture,
        MoveResult &outMove,
        BoardTransform &outTransform
    ) {
        int fromR = -1, fromC = -1;
        int toR = -1, toC = -1;
        int rem = 0, add = 0;

        for (int r = 0; r < 8; r++) {
            for (int c = 0; c < 8; c++) {
                if (oldB[r][c] && !newB[r][c]) {
                    rem++;
                    fromR = r;
                    fromC = c;
                } else if (!oldB[r][c] && newB[r][c]) {
                    add++;
                    toR = r;
                    toC = c;
                }
            }
        }

        if (rem != 1) {
            Serial.println("❌ Move inference failed: expected exactly 1 removed square.");
            return false;
        }

        if (!isCapture && add != 1) {
            Serial.println("❌ Move inference failed: normal move requires exactly 1 added square.");
            return false;
        }

        if (isCapture && add != 0) {
            Serial.println("❌ Move inference failed: capture occupancy requires 0 added squares.");
            return false;
        }

        const BoardTransform modes[4] = { MAP_IDENTITY, MAP_MIRROR_ROWS, MAP_MIRROR_COLS, MAP_MIRROR_BOTH };
        MoveResult candidates[64];
        BoardTransform candidateTransforms[64];
        int candidateCount = 0;
        bool hasLockedCandidate = false;
        MoveResult lockedCandidate;

        // For capture: pre-build FEN board so we can confirm the destination has an opponent piece.
        // This avoids false positives when multiple occupied squares are reachable by the moving piece.
        char fenBoard[8][8];
        if (isCapture) {
            fenToBoard(normalizeFenForBoard(oldFen), fenBoard);
        }
        bool isTurnWhite = (turn == "white");

        for (int i = 0; i < 4; i++) {
            BoardTransform transform = modes[i];
            String fromSq = sensorToSquare(fromR, fromC, transform);
            if (!fromSq.length()) continue;

            if (!isCapture) {
                String toSq = sensorToSquare(toR, toC, transform);
                if (!toSq.length()) continue;
                if (!validateChessMove(oldFen, fromSq, toSq, turn)) continue;

                MoveResult mv;
                mv.fromSq = fromSq;
                mv.toSq = toSq;
                mv.san = buildSimpleSan(oldFen, fromSq, toSq, false);
                mv.newFen = buildFenAfterMove(oldFen, fromSq, toSq);
                Serial.println(
                    "🧭 Candidate normal move: " + fromSq + " -> " + toSq +
                    ", mode=" + String((int)transform)
                );
                if (candidateCount < 64) {
                    candidates[candidateCount] = mv;
                    candidateTransforms[candidateCount] = transform;
                    candidateCount++;
                }
                if (transform == LOCKED_SENSOR_MAP) {
                    lockedCandidate = mv;
                    hasLockedCandidate = true;
                }
                continue;
            }

            // Capture case: only try squares that actually hold an opponent piece in the FEN.
            // This eliminates all other occupied squares from consideration and prevents
            // false positives (e.g. a queen that can reach multiple occupied squares).
            for (int rr = 0; rr < 8; rr++) {
                for (int cc = 0; cc < 8; cc++) {
                    if (!newB[rr][cc]) continue;
                    String toSq = sensorToSquare(rr, cc, transform);
                    if (!toSq.length() || toSq == fromSq) continue;

                    // Verify the FEN has an opponent piece at this chess square
                    int toChessRow = toSq.charAt(1) - '1';
                    int toChessCol = toSq.charAt(0) - 'a';
                    if (toChessRow < 0 || toChessRow > 7 || toChessCol < 0 || toChessCol > 7) continue;
                    char pieceThere = fenBoard[toChessRow][toChessCol];
                    bool hasOpponent = isTurnWhite
                        ? (pieceThere >= 'a' && pieceThere <= 'z')
                        : (pieceThere >= 'A' && pieceThere <= 'Z');
                    if (!hasOpponent) continue;

                    if (!validateChessMove(oldFen, fromSq, toSq, turn)) continue;

                    MoveResult mv;
                    mv.fromSq = fromSq;
                    mv.toSq = toSq;
                    mv.san = buildSimpleSan(oldFen, fromSq, toSq, true);
                    mv.newFen = buildFenAfterMove(oldFen, fromSq, toSq);
                    Serial.println(
                        "🧭 Candidate capture move: " + fromSq + " -> " + toSq +
                        ", mode=" + String((int)transform)
                    );
                    if (candidateCount < 64) {
                        candidates[candidateCount] = mv;
                        candidateTransforms[candidateCount] = transform;
                        candidateCount++;
                    }
                    if (transform == LOCKED_SENSOR_MAP) {
                        lockedCandidate = mv;
                        hasLockedCandidate = true;
                    }
                }
            }
        }

        if (candidateCount == 1) {
            outMove = candidates[0];
            outTransform = candidateTransforms[0];
            Serial.println("✅ Move inference succeeded with a unique mapping.");
            return true;
        }

        if (candidateCount > 1 && hasLockedCandidate) {
            outMove = lockedCandidate;
            outTransform = LOCKED_SENSOR_MAP;
            Serial.println("✅ Move inference resolved by LOCKED_SENSOR_MAP.");
            Serial.println("ℹ️ Explanation: multiple legal symmetric mappings found; using fixed board wiring map.");
            return true;
        }

        if (candidateCount == 0) {
            Serial.println("❌ Move inference failed: no legal mapping matched board delta.");
        } else {
            Serial.println("❌ Move inference ambiguous: multiple legal mappings matched board delta.");
        }
        return false;
    }

    bool validateChessMove(const String &fen, const String &fromSq, const String &toSq, const String &currentTurn) {
        char board[8][8];
        String normalizedFen = normalizeFenForBoard(fen);
        fenToBoard(normalizedFen, board);
        int fromCol = fromSq.charAt(0) - 'a';
        int fromRow = fromSq.charAt(1) - '1';
        int toCol = toSq.charAt(0) - 'a';
        int toRow = toSq.charAt(1) - '1';
        bool valid = isValidMove(board, fromRow, fromCol, toRow, toCol, currentTurn);
        Serial.println(
            String(valid ? "✅" : "❌") +
            " validateChessMove: from=" + fromSq +
            ", to=" + toSq +
            ", turn=" + currentTurn +
            ", fen=" + normalizedFen
        );
        return valid;
    }

    void updateOldBoardFromFen(const String &fen) {
        String normalizedFen = normalizeFenForBoard(fen);
        String parts[6];
        int idx = 0, start = 0;
        for (int i = 0; i <= normalizedFen.length() && idx < 6; i++) {
            if (i == normalizedFen.length() || normalizedFen[i] == ' ') {
                parts[idx++] = normalizedFen.substring(start, i);
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
        
        // Store in sensor coordinates (not chess coordinates) so that lastBoard
        // and boardState (from physical sensors) share the same index space.
        // Mirror transform is self-inverse, so applying LOCKED_SENSOR_MAP maps chess→sensor.
        memset(lastBoard, 0, sizeof(lastBoard));
        for (int r = 0; r < 8; r++) {
            for (int c = 0; c < 8; c++) {
                int sr = r, sc = c;
                if (LOCKED_SENSOR_MAP == MAP_MIRROR_ROWS || LOCKED_SENSOR_MAP == MAP_MIRROR_BOTH) sr = 7 - r;
                if (LOCKED_SENSOR_MAP == MAP_MIRROR_COLS || LOCKED_SENSOR_MAP == MAP_MIRROR_BOTH) sc = 7 - c;
                lastBoard[sr][sc] = (board8[r][c] != '.');
            }
        }

        memcpy(protectedOldBoard, lastBoard, sizeof(lastBoard));
        protectedOldFen = normalizedFen;
        isBoardProtected = true;
    }

    bool submitMoveHTTP(const String &fromSq, const String &toSq, const String &san, const String &fen) {
        HTTPClient http;
        String url = getServerBaseUrl() + "/api/game/control-player";
        beginHttp(http, url);
        http.addHeader("Content-Type", "application/json");
        http.addHeader("Authorization", "Bearer " + userToken);

        String body = String("{") +
                    "\"gameId\":" + gameId + "," +
                    "\"playerId\":" + String(userId) + "," +
                    "\"action\":\"make_move\"," +
                    "\"moveData\":{" +
                    "\"from\":\"" + fromSq + "\"," +
                    "\"to\":\"" + toSq + "\"," +
                    "\"promotion\":\"\"," +
                    "\"san\":\"" + san + "\"," +
                    "\"fen\":\"" + fen + "\"" +
                    "}}";

        int httpCode = http.POST(body);
        bool success = (httpCode == HTTP_CODE_OK || httpCode == 201);

        if (success) {
            Serial.println("✅ Move confirmed via HTTP API");
        } else {
            Serial.println("❌ HTTP move failed, code=" + String(httpCode) + " body=" + http.getString());
        }
        http.end();
        return success;
    }

    // Communication Functions
    bool getTokenAndGameId() {
        HTTPClient http;
        String url = getServerBaseUrl() + "/api/users/" + String(userId) + "/token-and-game";

        beginHttp(http, url);
        int httpCode = http.GET();
        
        if (httpCode == HTTP_CODE_OK) {
            String payload = http.getString();
            DynamicJsonDocument doc(1024);
            DeserializationError error = deserializeJson(doc, payload);
            
            if (!error && doc["success"] == true) {
                userToken = doc["data"]["token"].as<String>();
                userToken.trim(); // strip whitespace/newlines that break JWT verify
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
        String url = getServerBaseUrl() + "/api/game/" + gameId;

        beginHttp(http, url);
        http.addHeader("Authorization", "Bearer " + userToken);
        int httpCode = http.GET();
        
        if (httpCode == HTTP_CODE_OK) {
            String payload = http.getString();
            DynamicJsonDocument doc(2048);
            DeserializationError error = deserializeJson(doc, payload);
            
            if (!error && doc["success"] == true) {
                String newFen = doc["data"]["currentFen"].as<String>();
                if (newFen.length() > 0) {
                    currentFen = normalizeFenForBoard(newFen);
                    updateOldBoardFromFen(currentFen);
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

    void joinCurrentGameRoom() {
        if (gameId.length() == 0) return;
        String j = "{\"gameId\":\"" + gameId + "\"}";
        webSocket.sendTXT("42/friends,[\"joinGameRoom\"," + j + "]");
        Serial.println("🎮 Joined game room: " + gameId);
    }

    void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
        if (type == WStype_CONNECTED) {
            Serial.println("🔌 WS connected (token len=" + String(userToken.length()) + ")");
            wsConnected = true;
        } else if (type == WStype_DISCONNECTED) {
            static uint8_t disconnectCount = 0;
            wsConnected = false;
            disconnectCount++;
            Serial.println("❌ WS disconnected (#" + String(disconnectCount) + ")");
            // After 5 consecutive disconnects, refresh token and re-init WebSocket
            // (handles expired JWT without requiring a full ESP restart)
            if (disconnectCount >= 5) {
                disconnectCount = 0;
                Serial.println("🔄 Refreshing token and reconnecting...");
                webSocket.disconnect();
                if (getTokenAndGameId()) {
                    connectWebSocket();
                    webSocket.onEvent(webSocketEvent);
                    webSocket.setReconnectInterval(3000);
                    webSocket.enableHeartbeat(15000, 5000, 2);
                }
            }
        } else if (type == WStype_PING) {
            // TCP-level WebSocket PING — library auto-replies PONG, nothing to do
        } else if (type == WStype_PONG) {
            // TCP-level WebSocket PONG received — connection alive
        } else if (type == WStype_TEXT) {
            String msg = String((char*)payload);

            // Socket.IO / Engine.IO heartbeat: server sends "2" (PING), must reply "3" (PONG)
            if (msg == "2") {
                webSocket.sendTXT("3");
                return;
            }

            if (msg.charAt(0) == '0') {
                webSocket.sendTXT("40/friends,{\"token\":\"" + userToken + "\"}");
                return;
            }

            if (msg.startsWith("40/friends")) {
                joinCurrentGameRoom();
                return;
            }

            // Namespace CONNECT_ERROR — auth rejected by server
            if (msg.startsWith("44/friends")) {
                Serial.println("❌ Auth rejected by server: " + msg);
                return;
            }

            // تماماً مثل الهاتف: استقبال moveMade وتحديث الحالة مباشرة بدون HTTP
            if (msg.indexOf("moveMade") != -1) {
                Serial.println("📡 moveMade received via WebSocket");

                // استخراج movedBy لتمييز حركة الخصم عن echo الحركة الخاصة
                String movedBy = "";
                int mbIdx = msg.indexOf("\"movedBy\":\"");
                if (mbIdx >= 0) {
                    int mbStart = mbIdx + 11;
                    int mbEnd = msg.indexOf("\"", mbStart);
                    if (mbEnd > mbStart) movedBy = msg.substring(mbStart, mbEnd);
                }

                bool isOwnEcho = (movedBy == playerColor);
                Serial.println("📡 movedBy=" + movedBy + " playerColor=" + playerColor +
                            (isOwnEcho ? " → own echo" : " → opponent move"));

                // تجاهل echo الحركة الخاصة أثناء فترة الحماية
                if (isOwnEcho && skipServerSync) {
                    Serial.println("⏸️ Skipping own-move echo during sync protection");
                    return;
                }

                // تحليل JSON مباشرة من رسالة WebSocket - تماماً كما يفعل الهاتف
                // الصيغة: 42/friends,["moveMade",{...}]
                int jsonObjStart = msg.indexOf(",{");
                if (jsonObjStart < 0) {
                    Serial.println("⚠️ Could not find JSON object in moveMade message");
                    return;
                }

                String jsonStr = msg.substring(jsonObjStart + 1);
                // إزالة ] الختامية
                while (jsonStr.length() > 0 && (jsonStr.charAt(jsonStr.length()-1) == ']' || jsonStr.charAt(jsonStr.length()-1) == ',')) {
                    jsonStr = jsonStr.substring(0, jsonStr.length()-1);
                }

                DynamicJsonDocument doc(2048);
                DeserializationError err = deserializeJson(doc, jsonStr);

                if (err != DeserializationError::Ok) {
                    Serial.println("⚠️ JSON parse error: " + String(err.c_str()));
                    // Fallback: HTTP فقط عند فشل التحليل
                    if (!isOwnEcho) updateBoardStateFromServer();
                    return;
                }

                String newFen  = doc["fen"].as<String>();
                String newTurn = doc["currentTurn"].as<String>();

                if (newFen.length() == 0 || newTurn.length() == 0) {
                    Serial.println("⚠️ Empty fen or currentTurn in moveMade payload");
                    if (!isOwnEcho) updateBoardStateFromServer();
                    return;
                }

                // تحديث الحالة مباشرة - لا HTTP، نفس ما يفعله الهاتف
                currentFen  = normalizeFenForBoard(newFen);
                currentTurn = newTurn;
                updateOldBoardFromFen(currentFen);

                // إشارة سريعة للـ loop لتنفيذ حركة الخصم فوراً قبل أي HTTP
                if (!isOwnEcho) opponentMovePending = true;

                Serial.println("✅ State updated from WS (direct): fen=" + currentFen);
                Serial.println("✅ currentTurn=" + currentTurn);
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

    // الدالة المسؤولة عن الوميض؛ الـ LED "نشط" بالـ HIGH
    void blinkLED(int n) {
        for (int i = 0; i < n; ++i) {
            digitalWrite(LED_PIN, HIGH); // HIGH = LED on
            delay(200);
            digitalWrite(LED_PIN, LOW);  // LOW  = LED off
            delay(200);
        }
    }

    void parseFen(const String &fen, char board[8][8]) {
        String normalizedFen = normalizeFenForBoard(fen);
        memset(board, '.', 64);
        int r = 0, c = 0;
        for (char ch : normalizedFen) {
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

    void moveServoSmooth(int targetAngle, int stepDelayMs) {
        (void)stepDelayMs;
        // Clamp only to hardware servo limits — do NOT restrict to SERVO_MIN/MAX_SAFE_ANGLE
        // so that SERVO_RELEASE_ANGLE (90) and SERVO_ENGAGE_ANGLE (0) are reached fully.
        int angle = constrain(targetAngle, 0, 180);
        myServo.write(angle);
        currentServoAngle = angle;
        servoAngleInitialized = true;
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
        motorA.setAcceleration(accel); motorB.setAcceleration(accel);
        motorA.setMaxSpeed(endSp);     motorB.setMaxSpeed(endSp);
        motorA.moveTo(tgtA); motorB.moveTo(tgtB);
        motorA.enableOutputs(); motorB.enableOutputs();
        delay(10);
        unsigned long wsTickAt = millis();
        while (motorA.distanceToGo() != 0 || motorB.distanceToGo() != 0) {
            motorA.run(); motorB.run();
            if (millis() - wsTickAt > 50) {
                webSocket.loop();
                // Re-enforce servo position — stepper PWM noise can corrupt servo signal
                myServo.write(currentServoAngle);
                wsTickAt = millis();
            }
        }
    }

    void moveToCell(int row, int col) {
        float dx = (row - currentRow) * CELL_SIZE_MM;
        float dy = colOffsets[col] - colOffsets[currentCol];
        if (row == currentRow) {
            float vdir = (currentRow <= (ROWS-1)/2 ? +1.0f : -1.0f);
            runSegment(vdir * halfRow, 0); runSegment(0, dy); runSegment(-vdir * halfRow, 0);
            currentCol = col; return;
        }
        if (col == currentCol) {
            float hdir = (currentCol <= (COLS-1)/2 ? +1.0f : -1.0f);
            runSegment(0, hdir * halfCol[currentCol]); runSegment(dx, 0); runSegment(0, -hdir * halfCol[col]);
            currentRow = row; return;
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
        currentRow = row; currentCol = col;
    }

    // Returns the HTTP base URL (DEPLOY_DOMAIN takes priority over local host:port)
    String getServerBaseUrl() {
        if (DEPLOY_DOMAIN.length() > 0) {
            return String(DEPLOY_USE_TLS ? "https" : "http") + "://" + DEPLOY_DOMAIN;
        }
        return "http://" + host + ":" + String(port);
    }

    // Shared secure client — kept alive for the duration of each HTTP request
    WiFiClientSecure _secureClient;

    // Set up HTTPClient for plain HTTP (local) or HTTPS (deployed).
    // Must call http.end() after the request; _secureClient lifetime is tied to this scope.
    void beginHttp(HTTPClient &http, const String &url) {
        if (DEPLOY_DOMAIN.length() > 0 && DEPLOY_USE_TLS) {
            _secureClient.setInsecure(); // accept any cert (no CA bundle on ESP32)
            http.begin(_secureClient, url);
        } else {
            http.begin(url);
        }
    }

    // Connects WebSocket to correct host/port based on deployment settings
    void connectWebSocket() {
        // Token in URL → populates socket.handshake.query.token on server (reliable for raw WS clients)
        String wsPath = "/socket.io/?EIO=4&transport=websocket&token=" + userToken;
        if (DEPLOY_DOMAIN.length() > 0) {
            if (DEPLOY_USE_TLS) {
                webSocket.beginSSL(DEPLOY_DOMAIN.c_str(), DEPLOY_WS_PORT, wsPath.c_str(), "");
                Serial.println("🔒 WS connecting via wss://: " + DEPLOY_DOMAIN + ":" + String(DEPLOY_WS_PORT));
            } else {
                webSocket.begin(DEPLOY_DOMAIN.c_str(), DEPLOY_WS_PORT, wsPath.c_str());
                Serial.println("🌐 WS connecting via ws://: " + DEPLOY_DOMAIN + ":" + String(DEPLOY_WS_PORT));
            }
        } else {
            webSocket.begin(host.c_str(), port, wsPath.c_str());
            Serial.println("🌐 WS connecting to local: " + host + ":" + String(port));
        }
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
        pinMode(RESIGN_PIN, INPUT_PULLUP); // تهيئة زر الاستسلام
        
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
        moveServoSmooth(SERVO_RELEASE_ANGLE); // RELEASE
        
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
        Serial.println("ℹ️ Debug pins: LED_PIN=" + String(LED_PIN) + ", DIR_PIN_A=" + String(DIR_PIN_A));
        
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
        
        connectWebSocket();
        webSocket.onEvent(webSocketEvent);
        webSocket.setReconnectInterval(3000);
        // Send a WebSocket-level PING every 15 s to keep the TCP connection alive
        // (keepalive below the Socket.IO heartbeat layer)
        webSocket.enableHeartbeat(15000, 5000, 2);

        // Attach interrupts AFTER pinMode so pins are ready
        attachInterrupt(digitalPinToInterrupt(BTN_PIN),    onBtnPress,    FALLING);
        attachInterrupt(digitalPinToInterrupt(RESIGN_PIN), onResignPress, FALLING);

        updateBoardStateFromServer();
        lastProcessedFen = currentFen;

        // lastBoard is already set from the server FEN by updateOldBoardFromFen() inside
        // updateBoardStateFromServer(). Do NOT overwrite it with a physical scan here —
        // if the ESP restarted mid-game the physical board may differ from the server FEN,
        // and using the physical state as lastBoard would cause the next button-press diff
        // to be computed against the wrong reference, potentially submitting an invalid move.
        // boardState is scanned once so we have a fresh sensor snapshot, but lastBoard stays FEN-based.
        scanBoard();  // populates boardState; lastBoard intentionally NOT updated here

        memcpy(protectedOldBoard, lastBoard, sizeof(lastBoard));
        protectedOldFen = currentFen;
        isBoardProtected = true;

        calibrateEmptyBoard(); // snapshot false-positive sensors on startup

        Serial.println("✅ Board initialized and ready!");
        Serial.println("🤖 Opponent move monitoring activated!");
        Serial.println("📡 WebSocket monitoring activated!");
        blinkLED(3);
    }

    // Loop Function
    void loop() {
        webSocket.loop();

        // Real-time sensor broadcast to frontend (every SENSOR_BROADCAST_INTERVAL_MS)
        if (wsConnected && gameId.length() > 0) {
            unsigned long nowMs = millis();
            if (nowMs - lastSensorBroadcast >= SENSOR_BROADCAST_INTERVAL_MS) {
                sendBoardSensorUpdate();
                lastSensorBroadcast = nowMs;
            }
        }

        // إضافة معالجة انقطاع الاتصال
        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("❌ WiFi disconnected, attempting to reconnect...");
            WiFi.reconnect();
            delay(1000);
            return;
        }

        // ==================== 0) أولوية قصوى: تنفيذ حركة الخصم فور وصول WS ====================
        // opponentMovePending يُعيَّن في webSocketEvent عند وصول moveMade من الخصم.
        // نتحقق هنا قبل أي HTTP لضمان أسرع استجابة ممكنة للرقعة الفيزيائية.
        if (opponentMovePending) {
            opponentMovePending = false;
            // تحقق مزدوج: هل تغيّر FEN فعلاً وهل هي حركة خصم؟
            if (currentFen != lastProcessedFen) {
                int fenSpaceIdx = currentFen.indexOf(' ');
                char fenTurnChar = (fenSpaceIdx >= 0) ? currentFen.charAt(fenSpaceIdx + 1) : '?';
                char playerColorChar = (playerColor == "white") ? 'w' : 'b';
                if (fenTurnChar == playerColorChar) {
                    Serial.println("⚡ Fast-path: WS opponent move → executing motors immediately");
                    executeOpponentMove(lastProcessedFen, currentFen);
                    lastProcessedFen = currentFen;
                    Serial.println("✅ Fast-path move executed");
                } else {
                    // echo للحركة الخاصة — لا تشغيل محركات
                    lastProcessedFen = currentFen;
                }
            }
        }

        // ==================== 1) جلب آخر FEN من السيرفر (احتياطي HTTP) ====================
        unsigned long currentTime = millis();
        if (currentTime - lastServerUpdate >= SERVER_UPDATE_INTERVAL) {
            String prevFen = currentFen; // حفظ FEN السابق للمقارنة

            // منع التزامن مع السيرفر مؤقتاً بعد الـ capture
            if (skipServerSync) {
                serverSyncSkipCount++;
                Serial.println("⏸️ Skipping server sync (" + String(serverSyncSkipCount) + "/" + String(SERVER_SYNC_SKIP_CYCLES) + ")");

                if (serverSyncSkipCount >= SERVER_SYNC_SKIP_CYCLES) {
                    skipServerSync = false;
                    serverSyncSkipCount = 0;
                    Serial.println("✅ Server sync resumed");
                }
            } else {
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
            }
            lastServerUpdate = currentTime;
        }

        // ==================== 2) كشف حركة الخصم من HTTP (احتياطي إذا فات WS) ====================
        if (currentFen != lastProcessedFen) {
            Serial.println("🤖 FEN changed");
            Serial.println("Last processed FEN: " + lastProcessedFen);
            Serial.println("Current FEN: " + currentFen);
            Serial.println("Current Turn: " + currentTurn);
            Serial.println("Player Color: " + playerColor);

            // Only execute motors when the new FEN shows it is NOW the player's turn,
            // meaning the OPPONENT just moved. Skip if it is still the opponent's turn
            // (player's own move reflected back, or AI playing the wrong color).
            int fenSpaceIdx = currentFen.indexOf(' ');
            char fenTurnChar = (fenSpaceIdx >= 0) ? currentFen.charAt(fenSpaceIdx + 1) : '?';
            char playerColorChar = (playerColor == "white") ? 'w' : 'b';
            bool isOpponentMove = (fenTurnChar == playerColorChar);

            if (isOpponentMove) {
                Serial.println("🤖 Opponent move detected - executing motors");
                executeOpponentMove(lastProcessedFen, currentFen);
                Serial.println("✅ Move executed - FEN updated");
            } else {
                Serial.println("⏩ FEN change is player's own move or server echo - skipping motors");
            }

            lastProcessedFen = currentFen;
        }
        
        // ==================== 3) فحص حالة اللعبة / الانتقال التلقائي للعبة جديدة ====================
        if (isFetchingNewGame) {
            if (currentTime - lastNewGamePoll >= NEW_GAME_POLL_INTERVAL) {
                lastNewGamePoll = currentTime;
                Serial.println("🔄 Polling for new active game...");

                String previousGameId = gameId;
                if (fetchLastActiveGame()) {
                    if (gameId.length() > 0 && gameId != lastEndedGameId) {
                        Serial.println("✅ New active game found: " + gameId);

                        // انضم لغرفة اللعبة الجديدة ثم حدّث الحالة المحلية.
                        joinCurrentGameRoom();
                        if (updateBoardStateFromServer()) {
                            lastProcessedFen = currentFen;
                            memcpy(protectedOldBoard, lastBoard, sizeof(lastBoard));
                            protectedOldFen = currentFen;
                            skipServerSync = false;
                            serverSyncSkipCount = 0;
                            hasResigned = false;
                            isFetchingNewGame = false;
                            btnPressedFlag = false;
                            resignPressedFlag = false;
                            // Re-scan physical board so lastBoard matches reality
                            scanBoardStable(boardState, 5, 5);
                            memcpy(lastBoard, boardState, sizeof(boardState));
                            memcpy(protectedOldBoard, lastBoard, sizeof(lastBoard));
                            Serial.println("✅ Ready for the new game without ESP restart.");
                            blinkLED(2);
                        } else {
                            Serial.println("⚠️ New game found but failed to sync board state. Will retry.");
                        }
                    } else {
                        Serial.println("⏳ No different active game yet. Waiting...");
                        gameId = previousGameId;
                    }
                } else {
                    Serial.println("⏳ No active game yet (or API response empty).");
                }
            }
        } else if (currentTime - lastGameStatusCheck >= GAME_STATUS_CHECK_INTERVAL) {
            Serial.println("🔍 Checking game status...");
            if (checkGameStatus()) {
                Serial.println("🏁 Game has ended - entered waiting mode for next game");
            } else {
                Serial.println("✅ Game is still active");
            }
            lastGameStatusCheck = currentTime;
        }
        
        // كشف حركة اللاعب عبر interrupt flag
        if (btnPressedFlag) {
            btnPressedFlag = false;
            Serial.println("🔘 BTN PRESSED");
            // Settle window: let the piece magnet stop moving before scanning.
            // 200ms + 15 samples × 8ms = ~320ms total — filters magnetic coupling transients.
            delay(200);
            scanBoardStable(boardState, 15, 8);
            printBoardArray(lastBoard, "Old Board");
            printBoardArray(boardState, "New Board");
            Serial.println("Old FEN: " + currentFen);
            Serial.println("Current Turn: " + currentTurn);
            Serial.println("Player Color: " + playerColor);
            
            int rem, add;
            countDiffs(lastBoard, boardState, rem, add);
            
            // --- Spurious-sensor recovery: rem=1, add=2 ---
            // This happens when a moving piece's magnet couples magnetically with a nearby sensor,
            // triggering a false "piece appeared" reading. Try to recover by checking if exactly
            // one of the two "added" squares is a valid move destination according to the FEN.
            if (rem == 1 && add == 2) {
                Serial.println("⚠️ rem=1,add=2 — attempting spurious-sensor recovery");
                logBoardDiffDetails(lastBoard, boardState);

                // Find the removed square (source) and the two added squares
                int srcR = -1, srcC = -1;
                int addR[2] = {-1, -1}, addC[2] = {-1, -1};
                int ai = 0;
                for (int r = 0; r < 8 && ai <= 2; r++) {
                    for (int c = 0; c < 8 && ai <= 2; c++) {
                        if (lastBoard[r][c] && !boardState[r][c]) { srcR = r; srcC = c; }
                        if (!lastBoard[r][c] && boardState[r][c] && ai < 2) { addR[ai] = r; addC[ai] = c; ai++; }
                    }
                }

                // Build a synthetic single-add board for each candidate and try to infer the move
                bool recovered = false;
                for (int candidate = 0; candidate < 2 && !recovered; candidate++) {
                    bool trialBoard[8][8];
                    memcpy(trialBoard, lastBoard, sizeof(lastBoard));
                    trialBoard[srcR][srcC] = false;
                    trialBoard[addR[candidate]][addC[candidate]] = true;
                    // The other candidate square must be empty in old board AND it appeared → spurious
                    int otherR = addR[1 - candidate], otherC = addC[1 - candidate];
                    // Check: other square was empty in lastBoard (it is, by definition of add)
                    // and leave trialBoard[otherR][otherC] = false (as in lastBoard)

                    MoveResult mv;
                    BoardTransform usedTransform = MAP_IDENTITY;
                    bool inferred = inferMoveTransform(lastBoard, trialBoard, currentFen, currentTurn, false, mv, usedTransform);
                    if (inferred && mv.fromSq.length() && mv.toSq.length() && mv.newFen.length()) {
                        Serial.println("🔧 Recovered: ignoring spurious sensor at r=" + String(otherR) + ",c=" + String(otherC));
                        // Accept the move using the clean trial board
                        memcpy(boardState, trialBoard, sizeof(trialBoard));
                        rem = 1; add = 1;
                        recovered = true;
                    }
                }

                if (!recovered) {
                    blinkLED(3);
                    Serial.println("❌ Recovery failed — rejecting move.");
                    memcpy(lastBoard, protectedOldBoard, sizeof(protectedOldBoard));
                    currentFen = protectedOldFen;
                }
                // If recovered, fall through to the rem==1 && add==1 branch below
            }

            if (rem > 1 || add > 1) {
                // Still invalid after any recovery attempt (double-restore is harmless)
                blinkLED(3);
                Serial.println("⚠️ Invalid board delta: rem=" + String(rem) + " add=" + String(add));
                logBoardDiffDetails(lastBoard, boardState);
                memcpy(lastBoard, protectedOldBoard, sizeof(protectedOldBoard));
                currentFen = protectedOldFen;

            } else if (rem == 1 && (add == 0 || add == 1)) {
                bool isCaptureShape = (add == 0);
                Serial.println(
                    String(isCaptureShape ? "🎯 Capture-shape" : "♟️ Normal-shape") +
                    " move detected: rem=" + String(rem) + ", add=" + String(add)
                );

                if (currentTurn != playerColor) {
                    Serial.println("⚠️ Move ignored: not your turn.");
                    Serial.println("ℹ️ Explanation: currentTurn=" + currentTurn + ", playerColor=" + playerColor);
                    blinkLED(2);
                    memcpy(lastBoard, protectedOldBoard, sizeof(protectedOldBoard));
                    currentFen = protectedOldFen;
                } else {
                    MoveResult mv;
                    BoardTransform usedTransform = MAP_IDENTITY;
                    bool inferred = inferMoveTransform(lastBoard, boardState, currentFen, currentTurn, isCaptureShape, mv, usedTransform);

                    if (!inferred || !mv.fromSq.length() || !mv.toSq.length() || !mv.newFen.length()) {
                        Serial.println("❌ Move inference failed, restoring protected state.");
                        Serial.println("ℹ️ Explanation: board delta cannot be mapped to one legal move.");
                        memcpy(lastBoard, protectedOldBoard, sizeof(protectedOldBoard));
                        currentFen = protectedOldFen;
                        blinkLED(3);
                    } else {
                        Serial.println("✅ Inferred move:");
                        Serial.println("   from=" + mv.fromSq + ", to=" + mv.toSq + ", san=" + mv.san);
                        Serial.println("   mappingMode=" + String((int)usedTransform));
                        Serial.println("   newFen=" + mv.newFen);

                        currentFen = mv.newFen;
                        memcpy(lastBoard, boardState, sizeof(boardState));
                        memcpy(protectedOldBoard, lastBoard, sizeof(lastBoard));
                        protectedOldFen = currentFen;

                        String nextTurn = (currentTurn == "white") ? "black" : "white";

                        // Promotion only when pawn reaches last rank
                        bool isPawnMove = (mv.san.length() > 0 && mv.san.charAt(0) >= 'a' && mv.san.charAt(0) <= 'h');
                        char toRankChar  = mv.toSq.charAt(1);
                        bool isPromotion = isPawnMove &&
                            ((playerColor == "white" && toRankChar == '8') ||
                             (playerColor == "black" && toRankChar == '1'));
                        String promVal = isPromotion ? "q" : "";

                        // Primary: WebSocket move event — isPhysical:true so phone shows board notification
                        String p = "{\"gameId\":" + gameId + "," +
                                "\"from\":\"" + mv.fromSq + "\"," +
                                "\"to\":\""   + mv.toSq   + "\"," +
                                "\"promotion\":\"" + promVal + "\"," +
                                "\"san\":\""  + mv.san    + "\"," +
                                "\"fen\":\""  + mv.newFen + "\"," +
                                "\"movedBy\":\"" + playerColor + "\"," +
                                "\"currentTurn\":\"" + nextTurn + "\"," +
                                "\"isPhysical\":true}";
                        String frame = "42/friends,[\"move\"," + p + "]";

                        if (wsConnected) {
                            webSocket.sendTXT(frame);
                            Serial.println("📤 Move sent via WebSocket (primary): " + mv.fromSq + "->" + mv.toSq);
                        } else {
                            // Fallback: HTTP عندما لا يكون WebSocket متصلاً
                            Serial.println("⚠️ WS not connected, falling back to HTTP");
                            bool httpOk = submitMoveHTTP(mv.fromSq, mv.toSq, mv.san, mv.newFen);
                            if (!httpOk) {
                                Serial.println("❌ HTTP fallback also failed");
                            }
                        }
                        Serial.println("ℹ️ Explanation: accepted legal move and synchronized local FEN.");

                        currentTurn = nextTurn;
                        lastProcessedFen = currentFen;
                        skipServerSync = true;
                        serverSyncSkipCount = 0;
                        Serial.println("⏸️ Temporary sync skip enabled to avoid self-move replay.");

                        digitalWrite(LED_PIN, HIGH);
                        delay(80);
                        digitalWrite(LED_PIN, LOW);
                    }
                }
            } else {
                Serial.println("⚠️ No legal move shape detected.");
                Serial.println("ℹ️ Explanation: expected (rem=1,add=1) or capture-shape (rem=1,add=0).");
                memcpy(lastBoard, protectedOldBoard, sizeof(protectedOldBoard));
                currentFen = protectedOldFen;
            }
        }
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
        int removedCount = 0, addedCount = 0;
        for (int r = 0; r < 8; ++r) {
            for (int c = 0; c < 8; ++c) {
                if (prevB[r][c] != '.' && curB[r][c] == '.') {
                    removedCount++;
                    fr = r; fc = c;
                    Serial.println("🔍 Found removed piece at: (" + String(r) + "," + String(c) + ")");
                }
                if (prevB[r][c] != curB[r][c] && curB[r][c] != '.') {
                    addedCount++;
                    tr = r; tc = c;
                    Serial.println("🔍 Found added piece at: (" + String(r) + "," + String(c) + ")");
                }
            }
        }

        if (removedCount != 1 || addedCount != 1) {
            moveServoSmooth(SERVO_RELEASE_ANGLE); // مهم
            Serial.println("❌ Ambiguous FEN diff: removed=" + String(removedCount) + " added=" + String(addedCount) + " - aborting motor move");
            return;
        }

        if (fr < 0 || tr < 0) {
            Serial.println("❌ Error: Could not determine move coordinates");
            return;
        }
        
        // حفظ الإحداثيات الأصلية قبل الانعكاس
        int originalFr = fr, originalFc = fc, originalTr = tr, originalTc = tc;
        
        bool capture = (prevB[originalTr][originalTc] != '.');
        Serial.println("🎯 Move: (" + String(fr) + "," + String(fc) + ") -> (" + String(tr) + "," + String(tc) + ")");
        Serial.println("🎯 Capture: " + String(capture ? "YES" : "NO"));

        // تحويل إحداثيات FEN إلى إحداثيات المحرك الفيزيائية.
        // الصفوف: FEN row 0 = rank8 (بعيد عن المحرك) → motor row 7، FEN row 7 = rank1 → motor row 0.
        // الأعمدة: motor col 0 = a-file (يسار أبيض) = نفس FEN col 0 → لا انعكاس للأعمدة.
        fr = 7 - originalFr;
        fc = originalFc;
        tr = 7 - originalTr;
        tc = originalTc;
        Serial.println("🔄 After transform: (" + String(fr) + "," + String(fc) + ") -> (" + String(tr) + "," + String(tc) + ")");

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
            moveServoSmooth(SERVO_RELEASE_ANGLE);
            delay(400); // let servo reach 90° before motors start
            moveToCell(gTr, gTc);
            // 2) ENGAGE — servo settle time
            moveServoSmooth(SERVO_ENGAGE_ANGLE);
            delay(150);
            // 3) move to scrap column while ENGAGED
            moveToCell(gTr, scrapCol);
            // 4) Tap down to seat piece, then RELEASE
            moveServoSmooth(SERVO_ENGAGE_ANGLE);
            delay(80);
            moveServoSmooth(SERVO_RELEASE_ANGLE);
            delay(150);
        }

        // Move active piece
        Serial.println("🤖 Moving piece from (" + String(gFr) + "," + String(gFc) + ") to (" + String(gTr) + "," + String(gTc) + ")");

        // 1) RELEASE → origin
        moveServoSmooth(SERVO_RELEASE_ANGLE);
        delay(400); // let servo reach 90° before motors start
        moveToCell(gFr, gFc);
        // 2) ENGAGE — servo settle time
        moveServoSmooth(SERVO_ENGAGE_ANGLE);
        delay(150);
        // 3) move to destination while ENGAGED
        moveToCell(gTr, gTc);
        // 4) Tap down to seat piece, then RELEASE — ensures servo always comes down
        moveServoSmooth(SERVO_ENGAGE_ANGLE);
        delay(80);
        moveServoSmooth(SERVO_RELEASE_ANGLE);
        delay(150);
        // Safety re-write in case PWM noise corrupted the release
        myServo.write(constrain(SERVO_RELEASE_ANGLE, 0, 180));
        Serial.println("✅ Opponent move executed successfully!");
    }

    // Scan board 10 times and mark any square that fires in ≥8 scans as a baseline false-positive.
    void calibrateEmptyBoard() {
        Serial.println("🔬 Calibrating empty board baseline...");
        const int SAMPLES = 10;
        const int THRESHOLD = 8; // must fire ≥8/10 scans to be marked as false-positive
        int counts[8][8] = {};
        for (int s = 0; s < SAMPLES; s++) {
            bool tmp[8][8];
            scanBoardTo(tmp);
            for (int r = 0; r < 8; r++)
                for (int c = 0; c < 8; c++)
                    if (tmp[r][c]) counts[r][c]++;
            delay(30);
        }
        int fpCount = 0;
        for (int r = 0; r < 8; r++) {
            for (int c = 0; c < 8; c++) {
                baselineBoard[r][c] = (counts[r][c] >= THRESHOLD);
                if (baselineBoard[r][c]) fpCount++;
            }
        }
        Serial.println("✅ Baseline done. False-positive squares: " + String(fpCount));
    }

    // Broadcast current sensor state to the frontend via WebSocket
    void sendBoardSensorUpdate() {
        static uint8_t prevRows[8] = {0}; // last broadcast (raw, before de-ghosting)

        bool sensorBoard[8][8];
        scanBoardTo(sensorBoard);

        // Convert sensor → chess coordinates (inverse of LOCKED_SENSOR_MAP).
        // rows[r]: r=0 → rank 1.  bit c: c=0 → file a.
        uint8_t rows[8] = {0};
        for (int sr = 0; sr < 8; sr++) {
            for (int sc = 0; sc < 8; sc++) {
                if (!sensorBoard[sr][sc] || baselineBoard[sr][sc]) continue; // skip false-positives
                int cr = sr, cc = sc;
                if (LOCKED_SENSOR_MAP == MAP_MIRROR_ROWS || LOCKED_SENSOR_MAP == MAP_MIRROR_BOTH) cr = 7 - sr;
                if (LOCKED_SENSOR_MAP == MAP_MIRROR_COLS || LOCKED_SENSOR_MAP == MAP_MIRROR_BOTH) cc = 7 - sc;
                rows[cr] |= (1u << cc);
            }
        }

        // Smart de-ghosting:
        // • If any new square just appeared (piece placed somewhere new) → use raw reading.
        //   This immediately clears the ghost of where the piece came from, once the reed
        //   switch at the origin opens.
        // • If no new squares appeared (stable state or piece still in transit) → apply
        //   1-frame persistence so brief reed-switch bounces during lift don't cause flicker.
        bool anyNew = false;
        for (int i = 0; i < 8; i++) {
            if (rows[i] & ~prevRows[i]) { anyNew = true; break; }
        }

        uint8_t sent[8];
        for (int i = 0; i < 8; i++) {
            sent[i] = anyNew ? rows[i]                // new arrival: show only current reading
                             : (rows[i] | prevRows[i]); // stable: persist 1 extra frame (anti-flicker)
        }
        memcpy(prevRows, rows, sizeof(rows));

        String payload = "{\"rows\":[";
        for (int i = 0; i < 8; i++) {
            if (i > 0) payload += ",";
            payload += String(sent[i]);
        }
        payload += "]}";
        webSocket.sendTXT("42/friends,[\"boardSensorUpdate\"," + payload + "]");
    }

    // دالة فحص حالة اللعبة
    bool checkGameStatus() {
        if (gameId.length() == 0) return false;

        HTTPClient http;
        String url = getServerBaseUrl() + "/api/game/" + gameId;

        beginHttp(http, url);
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
                    // أي لعبة منتهية => دخول وضع انتظار لعبة جديدة بدون الحاجة لإعادة تشغيل ESP.
                    if (!isFetchingNewGame) {
                        Serial.println("🏁 Game ended - returning motors to home position");
                        returnMotorsToHome();
                        lastEndedGameId = gameId;
                        isFetchingNewGame = true;
                        lastNewGamePoll = 0;
                        Serial.println("⏳ Waiting for a new active game...");
                    }
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

        // Raise servo fully before travel so it doesn't drag over pieces
        moveServoSmooth(SERVO_RELEASE_ANGLE);
        delay(150);

        // Move to home position (0,0)
        moveToCell(0, 0);

        // Keep servo raised at home
        moveServoSmooth(SERVO_RELEASE_ANGLE);

        Serial.println("✅ Motors returned to home position");
        blinkLED(5); // إشارة بصرية أن اللعبة انتهت
    }

    // يستدعي API ليجلب آخر gameId نشطة للمستخدم userId
    bool fetchLastActiveGame() {
        HTTPClient http;
        String url = getServerBaseUrl() + "/api/users/games/active";
        beginHttp(http, url);
        http.addHeader("Authorization", "Bearer " + userToken);
        int code = http.GET();
        if (code == HTTP_CODE_OK) {
            String payload = http.getString();
            DynamicJsonDocument doc(1024);
            if (deserializeJson(doc, payload)==DeserializationError::Ok
                && doc["success"] == true) {
                JsonVariant data = doc["data"];
                if (data.isNull()) {
                    http.end();
                    return false;
                }

                String activeId = data["id"].as<String>();
                if (activeId.length() == 0) {
                    activeId = data["lastActiveGameId"].as<String>();
                }
                if (activeId.length() == 0) {
                    http.end();
                    return false;
                }

                gameId = activeId;
                if (!data["color"].isNull()) {
                    String c = data["color"].as<String>();
                    if (c == "white" || c == "black") {
                        playerColor = c;
                    }
                }
                http.end();
                return true;
            }
        }
        http.end();
        return false;
    }

    // دالة معالجة الـ capture
    void handleCapture(int r, int c) {
        Serial.println("🎯 Handling capture at: (" + String(r) + "," + String(c) + ")");
        
        // اقرأ القطعة من FEN
        char board8[8][8];
        fenToBoard(protectedOldFen, board8);
        char capturedPiece = board8[r][c]; // r و c الآن من FEN مباشرة
        
        // تحديد عمود الخردة حسب لون القطعة
        int scrapCol = isWhitePiece(capturedPiece) ? 0 : 9;
        
        Serial.println("🔍 Captured piece: " + String(capturedPiece) + " -> scrap column: " + String(scrapCol));
        
        // تحويل إحداثيات FEN إلى إحداثيات الحساسات (قلب الصفوف)
        int sensorRow = 7 - r; // FEN row=0 (rank8) -> sensor row=7
        int sensorCol = c;
        
        // 1) ارفع القطعة المأخوذة
        moveServoSmooth(SERVO_RELEASE_HOME_ANGLE); // RELEASE
        moveToCell(sensorRow, sensorCol + 1); // +1 offset for grid
        moveServoSmooth(SERVO_ENGAGE_ANGLE); // ENGAGE — wait for servo to reach down
        delay(200);

        // 2) ارميها في scrap
        moveToCell(sensorRow, scrapCol);
        moveServoSmooth(SERVO_RELEASE_HOME_ANGLE); // RELEASE
        delay(150);
        
        Serial.println("✅ Capture handled successfully!");
    }// Returns (r,c) of any removed piece between prevFen and currentFen, or (-1,-1) if none.
    std::pair<int,int> findCaptureFromFen(const String& prevFen, const String& currentFen) {
        char prevB[8][8], curB[8][8];
        parseFen(prevFen, prevB);
        parseFen(currentFen, curB);

        for (int r = 0; r < 8; ++r) {
            for (int c = 0; c < 8; ++c) {
                if (prevB[r][c] != '.' && curB[r][c] == '.') {
                    return {r, c};
                }
            }
        }
        return {-1, -1};
    }

