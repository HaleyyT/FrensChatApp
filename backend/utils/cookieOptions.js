const isProduction = process.env.NODE_ENV === "production";

export function getAuthCookieOptions(maxAge) {
    return {
        httpOnly: true,
        sameSite: isProduction ? "none" : "lax",
        secure: isProduction,
        path: "/",
        ...(maxAge !== undefined ? { maxAge } : {}),
    };
}
