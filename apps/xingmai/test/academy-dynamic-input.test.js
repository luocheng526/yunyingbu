import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

const js = await readFile(new URL("../public/shared/modules/academy.js", import.meta.url), "utf8");

function inputDouble() {
  const attributes = {};
  const listeners = {};
  const listenerCounts = {};
  return {
    attributes,
    listeners,
    listenerCounts,
    input: {
      value: "",
      selectionStart: 0,
      selectionEnd: 0,
      matches(selector) {
        return selector === ".academy-course-sub-form input";
      },
      getAttribute(name) {
        return attributes[name] || null;
      },
      setAttribute(name, value) {
        attributes[name] = value;
      },
      addEventListener(type, handler) {
        listeners[type] = handler;
        listenerCounts[type] = (listenerCounts[type] || 0) + 1;
      },
      setRangeText(text, from, to) {
        this.value = this.value.slice(0, from) + text + this.value.slice(to);
        this.selectionStart = this.selectionEnd = from + text.length;
      },
      dispatchEvent() {}
    }
  };
}

test("new course submenu inputs receive one keyboard fallback after rerender and focus", () => {
  const start = js.indexOf("  function replaceTitleSelection");
  const end = js.indexOf("  function examUploadPaneHtml", start);
  assert.ok(start >= 0 && end > start);
  const first = inputDouble();
  const replacement = inputDouble();
  const replacementRoot = {
    matches() {
      return false;
    },
    querySelectorAll() {
      return [replacement.input];
    }
  };
  vm.runInNewContext(
    `${js.slice(start, end)}
     installTitleKeyboardFallbacks(firstInput);
     installTitleKeyboardFallbacks(firstInput);
     installTitleKeyboardFallbacks(replacementRoot);
     installTitleKeyboardFallbacks(replacementInput);`,
    {
      Event: class Event {},
      window: { setTimeout: (fn) => fn() },
      firstInput: first.input,
      replacementInput: replacement.input,
      replacementRoot
    }
  );

  assert.deepEqual(first.listenerCounts, {
    beforeinput: 1,
    compositionstart: 1,
    compositionend: 1,
    keydown: 1
  });
  assert.deepEqual(replacement.listenerCounts, first.listenerCounts);
  let prevented = false;
  replacement.listeners.beforeinput({
    inputType: "insertText",
    data: "直播话术",
    preventDefault() {
      prevented = true;
    }
  });
  assert.equal(prevented, true);
  assert.equal(replacement.input.value, "直播话术");
});

test("course submenu lookup uses direct children without :scope", () => {
  assert.match(js, /function directCourseSubForm/);
  assert.match(js, /Array\.prototype\.find\.call\(group \? group\.children : \[\]/);
  assert.doesNotMatch(js, /querySelector\(":scope > \.academy-course-sub-form"\)/);
  assert.match(js, /courseTree\.addEventListener\("focusin"/);
});
