import { describe, it, expect } from "vitest";
import { extractJSON, extractXML, extractXMLAttr } from "./json-parser";

describe("extractJSON", () => {
  it("parses a plain JSON object", () => {
    expect(extractJSON('{"a":1,"b":"x"}')).toEqual({ a: 1, b: "x" });
  });

  it("strips a ```json fenced block", () => {
    const raw = "Here:\n```json\n{\"k\": 2}\n```\ndone";
    expect(extractJSON(raw)).toEqual({ k: 2 });
  });

  it("strips a bare ``` fence (no language tag)", () => {
    expect(extractJSON("```\n{\"k\": 3}\n```")).toEqual({ k: 3 });
  });

  it("extracts the outermost {...} when surrounded by prose", () => {
    expect(extractJSON('noise {"a": 9} trailing')).toEqual({ a: 9 });
  });

  it("repairs trailing commas before } and ]", () => {
    expect(extractJSON('{"a":1,}')).toEqual({ a: 1 });
    expect(extractJSON('{"a":[1,2,]}')).toEqual({ a: [1, 2] });
  });

  it("converts single-quoted JSON to double-quoted", () => {
    expect(extractJSON("{'a':1,'b':'x'}")).toEqual({ a: 1, b: "x" });
  });

  it("repairs truncated JSON by appending closing brace", () => {
    // Missing closing brace — repair path appends } and returns best-effort parse
    const out = extractJSON('{"a":1');
    expect(out).toHaveProperty("a");
  });

  it("repairs truncated JSON missing closing bracket and brace", () => {
    expect(extractJSON('{"a":[1,2')).toEqual({ a: [1, 2] });
  });

  it("repairs unterminated string by appending quotes and closers", () => {
    // Unterminated value: repairable, returns best-effort parse
    const out = extractJSON('{"k":"ab');
    expect(out).toHaveProperty("k");
  });

  it("returns {} when no JSON is present", () => {
    expect(extractJSON("just some text")).toEqual({});
  });

  it("strips BOM / zero-width characters before parsing", () => {
    expect(extractJSON('﻿{"a":1}')).toEqual({ a: 1 });
  });
});

describe("extractXML", () => {
  it("extracts inner text of a tag", () => {
    expect(extractXML("<emotion>joy</emotion>", "emotion")).toBe("joy");
  });

  it("handles multi-line content (dotall)", () => {
    const raw = "<psychology>\n  <emotion>x</emotion>\n</psychology>";
    expect(extractXML(raw, "psychology")).toContain("<emotion>x</emotion>");
  });

  it("returns null when tag is absent", () => {
    expect(extractXML("<a>1</a>", "b")).toBeNull();
  });

  it("trims surrounding whitespace", () => {
    expect(extractXML("<t>   hi   </t>", "t")).toBe("hi");
  });
});

describe("extractXMLAttr", () => {
  it("extracts an attribute value", () => {
    expect(extractXMLAttr('<attachment activation="0.6" strategy="secure"/>', "attachment", "activation")).toBe("0.6");
  });

  it("extracts strategy attribute", () => {
    expect(extractXMLAttr('<attachment activation="0.6" strategy="secure"/>', "attachment", "strategy")).toBe("secure");
  });

  it("returns null when attribute is absent", () => {
    expect(extractXMLAttr('<attachment activation="0.6"/>', "attachment", "strategy")).toBeNull();
  });
});
