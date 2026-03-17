package com.hdt.app;

import android.os.Bundle;
import android.view.View;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Ensure the window decor fits system windows to allow manual inset handling
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        
        final View rootView = findViewById(android.R.id.content);
        
        if (rootView != null) {
            // Apply padding to the root view to respect the status bar height
            ViewCompat.setOnApplyWindowInsetsListener(rootView, (v, insets) -> {
                int top = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top;
                
                // Apply padding only if it's actually needed to clear the status bar
                v.setPadding(0, top, 0, 0);
                
                return insets;
            });
        }

        // Configure the status bar appearance to match the system theme
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            boolean isDarkMode = (getResources().getConfiguration().uiMode & android.content.res.Configuration.UI_MODE_NIGHT_MASK) 
                                 == android.content.res.Configuration.UI_MODE_NIGHT_YES;
            
            controller.setAppearanceLightStatusBars(!isDarkMode);
        }
    }
}