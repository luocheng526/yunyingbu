import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { loginShop, passwordFailureMessage } from "../src/modules/home/jingmai-client.js";

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
      return jsonResponse(
        { code: 1, data: { returnUrl: "https://shop.jd.com/" } },
        ["thor=session-ok; Domain=.jd.com; Path=/"]
      );
    }
    if (href.includes("shop.jd.com")) {
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
  assert.equal(seen.some(function (item) { return item.href.includes("/login/doLogin"); }), false);
  assert.equal(seen.some(function (item) { return item.href.includes("/login/component/v1/init"); }), true);
  assert.equal(seen.some(function (item) { return item.href.includes("/login/component/v1/loginSubmit"); }), true);
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
