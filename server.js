const crypto = require("crypto");
const express = require("express");
const multer = require("multer");
const { PNG } = require("pngjs");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = process.env.PORT || 3000;
const MAGIC = Buffer.from("STEG");
const SALT_SIZE = 16;
const IV_SIZE = 12;
const AUTH_TAG_SIZE = 16;
const ENCRYPTION_KEY_SIZE = 32;
const HEADER_SIZE = MAGIC.length + 4 + SALT_SIZE + IV_SIZE + AUTH_TAG_SIZE;

app.use(express.static("public"));

function deriveEncryptionKey(password, salt) {
  return crypto.scryptSync(password, salt, ENCRYPTION_KEY_SIZE);
}

function toPayload(message, key) {
  const messageBuffer = Buffer.from(message, "utf8");
  const salt = crypto.randomBytes(SALT_SIZE);
  const iv = crypto.randomBytes(IV_SIZE);
  const encryptionKey = deriveEncryptionKey(key, salt);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(messageBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(encrypted.length, 0);

  return Buffer.concat([MAGIC, lengthBuffer, salt, iv, authTag, encrypted]);
}

function fromPayload(payload, key) {
  if (payload.length < HEADER_SIZE) {
    throw new Error("The image does not contain a valid hidden message.");
  }

  const magic = payload.subarray(0, MAGIC.length);
  if (!magic.equals(MAGIC)) {
    throw new Error("The image does not contain a valid hidden message.");
  }

  const encryptedLength = payload.readUInt32BE(MAGIC.length);
  const expectedLength = HEADER_SIZE + encryptedLength;
  if (payload.length < expectedLength) {
    throw new Error("The hidden message appears to be incomplete or corrupted.");
  }

  let cursor = MAGIC.length + 4;
  const salt = payload.subarray(cursor, cursor + SALT_SIZE);
  cursor += SALT_SIZE;
  const iv = payload.subarray(cursor, cursor + IV_SIZE);
  cursor += IV_SIZE;
  const authTag = payload.subarray(cursor, cursor + AUTH_TAG_SIZE);
  const encrypted = payload.subarray(HEADER_SIZE, expectedLength);

  try {
    const encryptionKey = deriveEncryptionKey(key, salt);
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (error) {
    throw new Error("The key is incorrect or the hidden data is corrupted.");
  }
}

function getCapacity(png) {
  return Math.floor(png.data.length / 4) * 3;
}

function encodeBitsIntoPng(png, payload) {
  const capacity = getCapacity(png);
  const requiredBits = payload.length * 8;

  if (requiredBits > capacity) {
    throw new Error("Message is too large for this image.");
  }

  let bitIndex = 0;

  for (let pixelIndex = 0; pixelIndex < png.data.length && bitIndex < requiredBits; pixelIndex += 4) {
    for (let channelOffset = 0; channelOffset < 3 && bitIndex < requiredBits; channelOffset += 1) {
      const byteIndex = Math.floor(bitIndex / 8);
      const bitOffset = 7 - (bitIndex % 8);
      const bit = (payload[byteIndex] >> bitOffset) & 1;
      png.data[pixelIndex + channelOffset] = (png.data[pixelIndex + channelOffset] & 0xfe) | bit;
      bitIndex += 1;
    }
  }
}

function decodeBitsFromPng(png) {
  const bytes = [];
  let currentByte = 0;
  let bitCount = 0;
  let expectedBytes = null;

  for (let pixelIndex = 0; pixelIndex < png.data.length; pixelIndex += 4) {
    for (let channelOffset = 0; channelOffset < 3; channelOffset += 1) {
      const bit = png.data[pixelIndex + channelOffset] & 1;
      currentByte = (currentByte << 1) | bit;
      bitCount += 1;

      if (bitCount === 8) {
        bytes.push(currentByte);
        currentByte = 0;
        bitCount = 0;

        if (bytes.length >= HEADER_SIZE && expectedBytes === null) {
          const headerBuffer = Buffer.from(bytes);
          if (!headerBuffer.subarray(0, MAGIC.length).equals(MAGIC)) {
            throw new Error("No hidden message was found in this image.");
          }
          expectedBytes = HEADER_SIZE + headerBuffer.readUInt32BE(MAGIC.length);
        }

        if (expectedBytes !== null && bytes.length === expectedBytes) {
          return Buffer.from(bytes);
        }
      }
    }
  }

  throw new Error("No complete hidden message was found in this image.");
}

function readPngFromBuffer(buffer) {
  try {
    return PNG.sync.read(buffer);
  } catch (error) {
    throw new Error("Please upload a valid PNG image.");
  }
}

app.post("/api/encode", upload.single("image"), (req, res) => {
  try {
    const { message, key } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "Image is required." });
    }

    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    if (!key) {
      return res.status(400).json({ error: "Key is required." });
    }

    const png = readPngFromBuffer(req.file.buffer);
    const payload = toPayload(message, key);
    encodeBitsIntoPng(png, payload);
    const encodedBuffer = PNG.sync.write(png);

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", 'attachment; filename="encoded-image.png"');
    return res.send(encodedBuffer);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post("/api/decode", upload.single("image"), (req, res) => {
  try {
    const { key } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "Image is required." });
    }

    if (!key) {
      return res.status(400).json({ error: "Key is required." });
    }

    const png = readPngFromBuffer(req.file.buffer);
    const payload = decodeBitsFromPng(png);
    const message = fromPayload(payload, key);

    return res.json({ message });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
