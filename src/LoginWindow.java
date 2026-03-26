import javafx.application.Application;
import javafx.application.Platform;
import javafx.concurrent.Worker;
import javafx.scene.Scene;
import javafx.scene.control.Alert;
import javafx.scene.control.TextInputDialog;
import javafx.scene.web.WebView;
import javafx.stage.Stage;
import netscape.javascript.JSObject;
import java.io.File;
import java.util.Optional;

public class LoginWindow extends Application {
    private static final String LOGIN_PAGE_PATH = "web/index.html";
    private static final String WINDOW_TITLE = "Quiz Game Login";
    private static final String AUTH_PREFIX = "__AUTH__";
    private static final String APP_TITLE = "Quiz Game";
    private static final String ERROR_STATUS = "ERROR";

    @Override
    public void start(Stage stage) {
        WebView webView = createWebView();
        webView.getEngine().getLoadWorker().stateProperty().addListener((obs, oldState, newState) -> {
            if (newState == Worker.State.SUCCEEDED) {
                JSObject window = (JSObject) webView.getEngine().executeScript("window");
                window.setMember("otpBridge", new OtpBridge());
            }
        });
        webView.getEngine().load(new File(LOGIN_PAGE_PATH).toURI().toString());
        Scene scene = new Scene(webView, 960, 560);
        stage.setTitle(WINDOW_TITLE);
        stage.setScene(scene);
        stage.setMinWidth(820);
        stage.setMinHeight(520);
        stage.show();
    }

    private WebView createWebView() {
        WebView webView = new WebView();
        webView.getEngine().setJavaScriptEnabled(true);
        webView.getEngine().setOnAlert(event -> showInfo(event.getData()));
        webView.getEngine().setOnError(event -> System.err.println("Web error: " + event.getMessage()));
        webView.getEngine().setPromptHandler(this::handlePrompt);
        return webView;
    }

    private void showInfo(String message) {
        Platform.runLater(() -> {
            Alert alert = new Alert(Alert.AlertType.INFORMATION);
            alert.setTitle(APP_TITLE);
            alert.setHeaderText(null);
            alert.setContentText(message);
            alert.showAndWait();
        });
    }

    private String handlePrompt(javafx.scene.web.PromptData promptData) {
        String message = promptData.getMessage();

        if (message != null && message.startsWith(AUTH_PREFIX)) {
            return handleAuthCall(message);
        }

        TextInputDialog dialog = new TextInputDialog(promptData.getDefaultValue());
        dialog.setTitle(APP_TITLE);
        dialog.setHeaderText(null);
        dialog.setContentText(message == null ? "" : message);
        Optional<String> result = dialog.showAndWait();
        return result.orElse("");
    }

    private String handleAuthCall(String message) {
        String payload = message.substring(AUTH_PREFIX.length());
        if (payload.startsWith("OTP_SEND|")) {
            String email = payload.substring("OTP_SEND|".length()).trim();
            return handleOtpSend(email);
        }
        if (payload.startsWith("OTP_VERIFY|")) {
            String[] parts = payload.substring("OTP_VERIFY|".length()).split("\\|", 2);
            String email = parts.length > 0 ? parts[0].trim() : "";
            String code = parts.length > 1 ? parts[1].trim() : "";
            return handleOtpVerify(email, code);
        }
        Platform.runLater(() -> showInfo("Unsupported auth action."));
        return ERROR_STATUS;
    }

    private String handleOtpSend(String email) {
        // SMTP support removed; OTP delivery disabled
        return jsonResponse(false, "OTP delivery is disabled in this build.");
    }

    private String handleOtpVerify(String email, String code) {
        return jsonResponse(false, "OTP verification is disabled in this build.");
    }

    private String jsonResponse(boolean success, String message) {
        return String.format("{\"success\":%s,\"message\":\"%s\"}", success, message.replace("\"", "\\\""));
    }

    public static void main(String[] args) {
        launch(args);
    }

    public final class OtpBridge {
        public String sendOtp(String email) {
            return handleOtpSend(email);
        }

        public String verifyOtp(String email, String code) {
            return handleOtpVerify(email, code);
        }
    }

}
