import javafx.application.Application;
import javafx.scene.Scene;
import javafx.scene.web.WebView;
import javafx.stage.Stage;

import java.io.File;

/**
 * Main JavaFX entry that hosts the quiz UI in a WebView.
 */
public class QuizGame extends Application {

    @Override
    public void start(Stage stage) {
        WebView webView = new WebView();
        String quizPage = new File("web/quiz.html").toURI().toString();
        webView.getEngine().load(quizPage);

        Scene scene = new Scene(webView, 420, 680);
        stage.setTitle("Quiz Game");
        stage.setScene(scene);
        stage.show();
    }

    public static void main(String[] args) {
        launch(args);
    }
}
