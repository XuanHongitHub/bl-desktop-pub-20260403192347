import {
  applyEmbeddedLocalControlDefaults,
  LOCAL_CONTROL_DEFAULT_TOKEN,
  validateEnv,
} from "./main.js";

describe("buglogin-sync main bootstrap env", () => {
  it("applies embedded local control defaults", () => {
    const env = {
      BUGLOGIN_EMBEDDED_LOCAL_CONTROL: "1",
    } as NodeJS.ProcessEnv;

    applyEmbeddedLocalControlDefaults(env);

    expect(env.PORT).toBe("12342");
    expect(env.SYNC_TOKEN).toBe(LOCAL_CONTROL_DEFAULT_TOKEN);
    expect(env.CONTROL_API_TOKEN).toBe(LOCAL_CONTROL_DEFAULT_TOKEN);
  });

  it("accepts sqlite-backed local control mode without DATABASE_URL", () => {
    expect(() =>
      validateEnv({
        SYNC_TOKEN: "local-token",
        CONTROL_API_TOKEN: "local-token",
      } as NodeJS.ProcessEnv),
    ).not.toThrow();
  });

  it("rejects missing auth configuration", () => {
    expect(() => validateEnv({} as NodeJS.ProcessEnv)).toThrow(
      "SYNC_TOKEN or SYNC_JWT_PUBLIC_KEY",
    );
  });
});
