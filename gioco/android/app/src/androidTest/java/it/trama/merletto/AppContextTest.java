package it.trama.merletto;

import static org.junit.Assert.assertEquals;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Test strumentale (gira su un telefono o un emulatore, da Android Studio):
 * l'app installata ha l'identificativo definitivo e la categoria "gioco".
 * L'identificativo non si cambia mai dopo la prima pubblicazione (ARCHITETTURA 13).
 */
@RunWith(AndroidJUnit4.class)
public class AppContextTest {

    @Test
    public void identificativoDefinitivo() {
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("it.trama.merletto", appContext.getPackageName());
    }

    @Test
    public void categoriaGioco() {
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
        ApplicationInfo info = appContext.getApplicationInfo();
        if (android.os.Build.VERSION.SDK_INT >= 26) {
            assertEquals(ApplicationInfo.CATEGORY_GAME, info.category);
        }
    }
}
