# Stenographer

Stenographer is a small full-stack steganography app that hides a text message inside a PNG image and extracts it later using the same secret key.

## Features

- Encode a message into a PNG image
- Decode the hidden message from a PNG image
- Protect the hidden payload with a key-derived XOR keystream
- Download the encoded image directly from the browser

## Tech Stack

- Node.js
- Express
- Multer
- PNGJS
- Vanilla HTML, CSS, and JavaScript

## Run Locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the server:

   ```bash
   npm start
   ```

3. Open your browser at:

   ```text
   http://localhost:3000
   ```

## Notes

- This version supports PNG files.
- The same key used to encode the message is required to decode it.
- Larger images can hold larger messages.
