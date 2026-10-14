package it.trama.merletto;

import static org.junit.Assert.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.Test;

/**
 * Test locale (gira sul computer: Android Studio > Run 'Tests in it.trama.merletto',
 * oppure ./gradlew :app:testDebugUnitTest): le impostazioni del manifest richieste
 * da ARCHITETTURA 13 ci sono ancora, anche dopo una modifica fatta a mano in
 * Android Studio. Lo stesso controllo, per entrambe le piattaforme, è in
 * scripts/check-native.mjs (npm run native:check).
 */
public class ManifestTest {

    private static String manifest() throws IOException {
        // I test locali partono dalla cartella del modulo (android/app).
        Path path = Paths.get("src", "main", "AndroidManifest.xml");
        return new String(Files.readAllBytes(path), StandardCharsets.UTF_8);
    }

    private static String tag(String xml, String regex) {
        Matcher m = Pattern.compile(regex, Pattern.DOTALL).matcher(xml);
        return m.find() ? m.group() : "";
    }

    @Test
    public void applicazioneDiCategoriaGioco() throws IOException {
        String application = tag(manifest(), "<application\\b[^>]*>");
        assertTrue("manca android:appCategory=\"game\" su <application>",
            application.contains("android:appCategory=\"game\""));
    }

    @Test
    public void activitySegueLaRotazioneDellUtente() throws IOException {
        String activity = tag(manifest(), "<activity\\b[^>]*android:name=\"\\.MainActivity\"[^>]*>");
        assertTrue("manca android:screenOrientation=\"fullUser\" su MainActivity",
            activity.contains("android:screenOrientation=\"fullUser\""));
    }
}
