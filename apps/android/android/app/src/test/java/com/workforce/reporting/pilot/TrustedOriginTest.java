package com.workforce.reporting.pilot;
import org.junit.Test;
import static org.junit.Assert.*;
public class TrustedOriginTest {
    private final String origin = "https://workforce.example";
    @Test public void refusesForeignOriginAndCredentials() {
        assertTrue(TrustedOrigin.employee(origin, origin + "/employee"));
        assertFalse(TrustedOrigin.employee(origin, "https://other.example/employee"));
        assertFalse(TrustedOrigin.employee(origin, "http://workforce.example/employee"));
        assertFalse(TrustedOrigin.employee(origin, "https://user@workforce.example/employee"));
        assertFalse(TrustedOrigin.employee(origin, origin + "/dashboard"));
    }
    @Test public void qrRequiresExactActivationShapeAndOneUseToken() {
        String token = "a".repeat(64);
        assertTrue(TrustedOrigin.activation(origin, origin + "/employee/activate#" + token));
        assertFalse(TrustedOrigin.activation(origin, origin + "/employee/activate?token=" + token));
        assertFalse(TrustedOrigin.activation(origin, origin + "/employee/activate#short"));
        assertFalse(TrustedOrigin.activation(origin, origin + "/employee/activate/other#" + token));
        assertFalse(TrustedOrigin.activation(origin, "https://evil.example/employee/activate#" + token));
        assertFalse(TrustedOrigin.activation(origin, null));
    }
}
