import javafx.application.Application;
import javafx.scene.Scene;
import javafx.scene.control.Alert;
import javafx.scene.layout.StackPane;
import javafx.scene.web.WebView;
import javafx.stage.Stage;

import java.io.File;

/**
 * Lightweight launcher that opens the web-based start page inside a JavaFX WebView.
 */
public class StartingWindow extends Application {

    @Override
    public void start(Stage stage) {
        WebView webView = new WebView();
        String startPage = new File("web/start.html").toURI().toString();
        webView.getEngine().load(startPage);

        Scene scene = new Scene(new StackPane(webView), 360, 620);
        stage.setTitle("Quiz Game");
        stage.setScene(scene);
        stage.show();
    }

    public static void main(String[] args) {
        try {
            launch(args);
        } catch (Exception e) {
            Alert alert = new Alert(Alert.AlertType.ERROR, "Unable to launch start window: " + e.getMessage());
            alert.showAndWait();
        }
    }
}
