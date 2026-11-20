import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Buffer } from "node:buffer";
import { cookieHeader, loginShop, passwordFailureMessage, pollQrLogin, startQrLogin } from "../src/modules/home/jingmai-client.js";

function pemPublic() {
  const pair = crypto.generateKeyPairSync("rsa", { modulusLength: 1024 });
  return pair.publicKey
    .export({ type: "spki", format: "pem" })
    .replace("-----BEGIN PUBLIC KEY-----", "")
    .replace("-----END PUBLIC KEY-----", "")
    .replace(/\s/g, "");
}

function jsonResponse(body, cookies) {
  const lines = Array.isArray(cookies) ? cookies : [];
  return {
    status: 200,
    headers: {
      get: function (name) {
        if (String(name).toLowerCase() === "set-cookie") {
          return lines[0] || "";
        }
        return "";
      },
      getSetCookie: function () {
        return lines;
      }
    },
    text: async function () {
      return JSON.stringify(body);
    },
    arrayBuffer: async function () {
      return Buffer.from(JSON.stringify(body));
    }
  };
}

test("password failures surface 账号异常 and captcha instead of a generic wrong password", () => {
  assert.equal(passwordFailureMessage({ data: { emptyAuthcode: true } }), "请先完成滑动验证");
  assert.equal(
    passwordFailureMessage({ code: 0, msg: "当前账号异常，暂无法登录" }),
    "当前账号异常，暂无法登录"
  );
  assert.equal(passwordFailureMessage({ data: {} }), "账号或密码不正确");
});

test("silent shop login uses the encrypted passport session, not the old doLogin post", async () => {
  const publicKey = pemPublic();
  const seen = [];
  const fetchImpl = async function (url, options) {
    const href = String(url);
    seen.push({ href: href, method: (options && options.method) || "GET" });
    if (href.includes("/login/component/v1/init")) {
      return jsonResponse({
        code: 1,
        data: {
          uuid: "u1",
          loginId: "id1",
          sa_token: "sa",
          publicKey: publicKey,
          aksPublicKey: publicKey,
          useSlideAuthCode: false,
          graphicCaptcha: {}
        }
      }, ["init_session=bootstrap; Path=/login; Secure; HttpOnly; SameSite=Lax"]);
    }
    if (href.includes("summer-cryptico")) {
      return {
        status: 200,
        headers: { get: function () { return ""; } },
        text: async function () {
          return "this.SummerCryptico={encryptData:function(k,t){return String(t||'ok')}}";
        }
      };
    }
    if (href.includes("/login/component/v1/loginSubmit")) {
      assert.equal(options.headers.cookie, "init_session=bootstrap");
      return jsonResponse(
        { code: 1, data: { returnUrl: "https://shop.jd.com/" } },
        ["thor=session-ok; Domain=.jd.com; Path=/; Secure; HttpOnly; Max-Age=3600"]
      );
    }
    if (href.includes("shop.jd.com")) {
      assert.equal(options.headers.cookie, "thor=session-ok");
      return {
        status: 200,
        headers: { get: function () { return ""; } },
        text: async function () { return "ok"; },
        arrayBuffer: async function () { return Buffer.from("ok"); }
      };
    }
    throw new Error("unexpected " + href);
  };
  const jar = await loginShop("简泓-五八", "secret", fetchImpl);
  assert.equal(jar.some(function (item) { return item.name === "thor" && item.value === "session-ok"; }), true);
  const session = jar.find(function (item) { return item.name === "thor"; });
  assert.equal(session.domain, ".jd.com");
  assert.equal(session.path, "/");
  assert.equal(session.secure, true);
  assert.equal(session.httpOnly, true);
  assert.ok(session.expires * 1000 > Date.now());
  const initCookie = jar.find(function (item) { return item.name === "init_session"; });
  assert.equal(initCookie.hostOnly, true);
  assert.equal(initCookie.host, "passport.jd.com");
  assert.equal(initCookie.sameSite, "Lax");
  assert.equal(cookieHeader(jar, "https://sff.jd.com/api"), "thor=session-ok");
  assert.equal(cookieHeader(jar, "http://sff.jd.com/api"), "");
  assert.equal(cookieHeader(jar, "https://example.org/"), "");
  assert.equal(seen.some(function (item) { return item.href.includes("/login/doLogin"); }), false);
  assert.equal(seen.some(function (item) { return item.href.includes("/login/component/v1/init"); }), true);
  assert.equal(seen.some(function (item) { return item.href.includes("/login/component/v1/loginSubmit"); }), true);
});

test("QR initialization, polling and confirmation preserve cookie scope", async () => {
  let checks = 0;
  const fetchImpl = async function (url, options) {
    const href = String(url);
    if (href.includes("initLoginPageData")) {
      return jsonResponse({ data: { uuid: "qr-id" } }, [
        "qr_session=bootstrap; Domain=.jd.com; Path=/; Secure",
        "passport_only=private; Path=/; Secure"
      ]);
    }
    if (href.includes("qrcode_show")) {
      assert.equal(options.headers.cookie, "qr_session=bootstrap");
      const response = jsonResponse({});
      response.arrayBuffer = async function () { return Buffer.from([0x89, 0x50, 0x4e, 0x47]); };
      return response;
    }
    if (href.includes("qrcode_check")) {
      assert.equal(options.headers.cookie, "qr_session=bootstrap");
      checks += 1;
      return jsonResponse({ resultInfo: { result: { state: checks === 1 ? 10 : 1, returnUrl: "https://shop.jd.com/" } } },
        checks === 1 ? [] : ["thor=qr-ok; Domain=.jd.com; Path=/; Secure; HttpOnly"]);
    }
    if (href === "https://shop.jd.com/") {
      assert.equal(options.headers.cookie, "qr_session=bootstrap; thor=qr-ok");
      return jsonResponse({});
    }
    throw new Error("unexpected " + href);
  };
  const opened = await startQrLogin(fetchImpl);
  const waiting = await pollQrLogin({ uuid: opened.uuid, jar: opened.jar, fetchImpl });
  assert.equal(waiting.status, "waiting");
  const confirmed = await pollQrLogin({ uuid: opened.uuid, jar: waiting.jar, fetchImpl });
  assert.equal(confirmed.status, "ok");
  assert.equal(cookieHeader(confirmed.jar, "https://sff.jd.com/api"), "qr_session=bootstrap; thor=qr-ok");
  assert.equal(cookieHeader(confirmed.jar, "https://example.org/"), "");
  assert.equal(confirmed.jar.find(function (item) { return item.name === "thor"; }).httpOnly, true);
});

test("silent shop login stops on 账号异常 instead of opening a waiting desk", async () => {
  const publicKey = pemPublic();
  const fetchImpl = async function (url) {
    const href = String(url);
    if (href.includes("/login/component/v1/init")) {
      return jsonResponse({
        code: 1,
        data: {
          uuid: "u1",
          loginId: "id1",
          sa_token: "sa",
          publicKey: publicKey,
          aksPublicKey: publicKey,
          useSlideAuthCode: false,
          graphicCaptcha: {}
        }
      });
    }
    if (href.includes("summer-cryptico")) {
      return {
        status: 200,
        headers: { get: function () { return ""; } },
        text: async function () {
          return "this.SummerCryptico={encryptData:function(k,t){return String(t||'ok')}}";
        }
      };
    }
    if (href.includes("/login/component/v1/loginSubmit")) {
      return jsonResponse({ code: 0, msg: "当前账号异常，暂无法登录" });
    }
    throw new Error("unexpected " + href);
  };
  await assert.rejects(
    function () {
      return loginShop("dikttjj", "secret", fetchImpl);
    },
    function (error) {
      assert.equal(error.code, "login");
      assert.equal(error.message, "当前账号异常，暂无法登录");
      return true;
    }
  );
});
