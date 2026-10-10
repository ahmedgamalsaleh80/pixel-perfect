import { describe, expect, it } from "vitest";
import { driveEmbedUrl, isValidDriveUrl, parseDriveFileId } from "./drive";

const ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";

describe("Google Drive URL parser", () => {
  it("accepts the standard file share link", () => {
    expect(parseDriveFileId(`https://drive.google.com/file/d/${ID}/view?usp=sharing`)).toBe(ID);
  });
  it("accepts open?id= links", () => {
    expect(parseDriveFileId(`https://drive.google.com/open?id=${ID}`)).toBe(ID);
  });
  it("builds the embedded player URL", () => {
    expect(driveEmbedUrl(`https://drive.google.com/file/d/${ID}/view`)).toBe(
      `https://drive.google.com/file/d/${ID}/preview`,
    );
  });
  it("rejects non-https, other hosts and script schemes", () => {
    expect(isValidDriveUrl(`http://drive.google.com/file/d/${ID}/view`)).toBe(false);
    expect(isValidDriveUrl(`https://drive.google.com.evil.com/file/d/${ID}/view`)).toBe(false);
    expect(isValidDriveUrl("javascript:alert(1)")).toBe(false);
    expect(isValidDriveUrl("https://youtube.com/watch?v=abc")).toBe(false);
    expect(isValidDriveUrl("not a url")).toBe(false);
  });
});
