package com.example.demo;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * PatchFlow Spring Boot SDK — Autonomous Incident Interceptor
 * 
 * Drop this class into your Spring Boot project (src/main/java/.../).
 * Requires zero extra Maven/Gradle dependencies (uses Java 11+ HttpClient).
 */
@RestControllerAdvice
public class PatchFlowAdvice {

    // Set your API key here or via System.getenv("PATCHFLOW_API_KEY")
    private static final String API_KEY = System.getenv("PATCHFLOW_API_KEY") != null 
        ? System.getenv("PATCHFLOW_API_KEY") 
        : "YOUR_PATCHFLOW_API_KEY";

    private static final String HOST = System.getenv("PATCHFLOW_HOST") != null 
        ? System.getenv("PATCHFLOW_HOST") 
        : "https://patchflow-backend-xax6.onrender.com";

    private static final HttpClient client = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(5))
        .build();

    static {
        // Startup heartbeat ping to mark SDK active on PatchFlow dashboard
        if (!API_KEY.equals("YOUR_PATCHFLOW_API_KEY") && !API_KEY.isEmpty()) {
            try {
                HttpRequest pingReq = HttpRequest.newBuilder()
                    .uri(URI.create(HOST + "/api/sdk/ping"))
                    .header("X-PatchFlow-Key", API_KEY)
                    .header("User-Agent", "patchflow-springboot/0.1.0")
                    .POST(HttpRequest.BodyPublishers.noBody())
                    .timeout(Duration.ofSeconds(5))
                    .build();
                client.sendAsync(pingReq, HttpResponse.BodyHandlers.discarding());
            } catch (Exception ignored) {}
        }
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<String> handleException(Exception ex, HttpServletRequest request) {
        // Capture culprit frame (skipping standard library internals)
        StackTraceElement culprit = null;
        for (StackTraceElement frame : ex.getStackTrace()) {
            if (!frame.getClassName().startsWith("java.") && !frame.getClassName().startsWith("org.springframework.")) {
                culprit = frame;
                break;
            }
        }
        if (culprit == null && ex.getStackTrace().length > 0) {
            culprit = ex.getStackTrace()[0];
        }

        String fileName = culprit != null && culprit.getFileName() != null ? culprit.getFileName() : "Unknown.java";
        int lineNo = culprit != null ? culprit.getLineNumber() : 1;
        String functionName = culprit != null ? culprit.getMethodName() : "unknown";

        String safeMessage = ex.getMessage() != null ? ex.getMessage().replace("\"", "'").replace("\n", " ") : "";
        String endpoint = request.getRequestURI();
        String method = request.getMethod();

        String payload = String.format("""
            {
              "error_type": "%s",
              "error_message": "%s",
              "endpoint": "%s",
              "method": "%s",
              "status_code": 500,
              "framework": "springboot",
              "stack_frames": [
                {
                  "filename": "%s",
                  "lineno": %d,
                  "function": "%s"
                }
              ]
            }
            """,
            ex.getClass().getSimpleName(),
            safeMessage,
            endpoint,
            method,
            fileName,
            lineNo,
            functionName
        );

        // Dispatch asynchronously without blocking client response
        try {
            HttpRequest postReq = HttpRequest.newBuilder()
                .uri(URI.create(HOST + "/api/sdk/errors"))
                .header("Content-Type", "application/json")
                .header("X-PatchFlow-Key", API_KEY)
                .header("User-Agent", "patchflow-springboot/0.1.0")
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .timeout(Duration.ofSeconds(10))
                .build();
            client.sendAsync(postReq, HttpResponse.BodyHandlers.discarding());
        } catch (Exception ignored) {}

        // Return a standard 500 response to caller
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body("{\"error\": \"Internal Server Error\", \"status\": 500}");
    }
}
