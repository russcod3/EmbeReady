# Local photo detector

The admin photo scanner uses `onnx-community/ai-image-detection-ONNX`, pinned to revision `e3cfe99f2841930a040a6281682c10c989965603` (Apache-2.0).

- Model: https://huggingface.co/onnx-community/ai-image-detection-ONNX
- Source model: https://huggingface.co/capcheck/ai-image-detection
- Runtime: https://huggingface.co/docs/transformers.js/v3.8.1/en/index
- Setup: `npm run setup:detector` downloads a quantized ONNX graph and validates its SHA-256.
- Runtime inference is CPU-only, in one worker thread, with remote models disabled. Report images remain on the application server.
- The FAKE class score is an uncalibrated model signal. It cannot establish whether a reported hazard exists, nor prove that a low-scoring image is authentic. Human verification remains the decision source.
- Only scores strictly above 0.5 produce the requested warning. They never delete, dismiss, or verify a report automatically.

The cache stores the image hash, model revision, score, and scan time. Missing files, failed inference, and changes during a scan produce an unavailable result, never a fabricated score.
