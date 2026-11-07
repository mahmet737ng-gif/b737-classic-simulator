package com.unified.b737classic;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Unified B737 Classic Android test wrapper.
 * Loads exactly the public cockpit web deployment (online mode).
 * All aircraft controls and systems remain implemented by the existing web app.
 */
public final class MainActivity extends Activity {
    private static final String COCKPIT_URL =
            "https://mahmet737ng-gif.github.io/b737-classic-simulator/panel-mosaic-lab/cockpit/";
    private WebView webView;
    private View splash;
    private View errorPanel;

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(11, 20, 37));
        getWindow().setNavigationBarColor(Color.rgb(11, 20, 37));

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(11, 20, 37));
        setContentView(root);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(11, 20, 37));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!request.isForMainFrame()) return false;
                if ("https".equalsIgnoreCase(uri.getScheme())
                        && "mahmet737ng-gif.github.io".equalsIgnoreCase(uri.getHost())) {
                    return false;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                    // Ignore an external URL that this device cannot handle.
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (splash != null) splash.setVisibility(View.GONE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                                        android.webkit.WebResourceError error) {
                if (request.isForMainFrame()) {
                    if (splash != null) splash.setVisibility(View.GONE);
                    if (errorPanel != null) errorPanel.setVisibility(View.VISIBLE);
                }
            }
        });
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        ImageView splashImage = new ImageView(this);
        splashImage.setImageResource(R.drawable.unified_splash);
        splashImage.setScaleType(ImageView.ScaleType.CENTER_CROP);
        splash = splashImage;
        root.addView(splash, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        LinearLayout retryLayout = new LinearLayout(this);
        retryLayout.setGravity(Gravity.CENTER);
        retryLayout.setOrientation(LinearLayout.VERTICAL);
        retryLayout.setPadding(36, 36, 36, 36);
        retryLayout.setBackgroundColor(Color.rgb(11, 20, 37));
        TextView error = new TextView(this);
        error.setText("Unified needs an internet connection to load the cockpit.");
        error.setTextColor(Color.WHITE);
        error.setTextSize(18);
        error.setGravity(Gravity.CENTER);
        retryLayout.addView(error);
        Button retry = new Button(this);
        retry.setText("RETRY");
        retry.setOnClickListener(v -> {
            errorPanel.setVisibility(View.GONE);
            splash.setVisibility(View.VISIBLE);
            webView.loadUrl(COCKPIT_URL);
        });
        retryLayout.addView(retry);
        errorPanel = retryLayout;
        errorPanel.setVisibility(View.GONE);
        root.addView(errorPanel, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        webView.loadUrl(COCKPIT_URL);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
