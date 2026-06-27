import { pipeline, env } from '@huggingface/transformers';

// Disable local models directory since we are in a browser
env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1; // CPU friendly

let generator: any = null;

self.addEventListener('message', async (event) => {
  const { text, tone, language } = event.data;
  
  try {
    if (!generator) {
      self.postMessage({ status: 'progress', message: 'Loading Local CPU Model (~300MB)...' });
      generator = await pipeline('text-generation', 'Xenova/SmolLM-135M-Instruct', {
        progress_callback: (x: any) => {
          self.postMessage({ status: 'progress', detail: x });
        }
      });
    }

    self.postMessage({ status: 'progress', message: 'Generating variations on CPU...' });

    const prompt = `<|im_start|>system\nYou are a writing assistant. Rephrase the following text to have a ${tone} tone${language !== 'Auto' ? ` in ${language}` : ''}. Respond ONLY with the rephrased text.<|im_end|>\n<|im_start|>user\n${text}<|im_end|>\n<|im_start|>assistant\n`;

    const out = await generator(prompt, {
      max_new_tokens: 150,
      temperature: 0.7,
      repetition_penalty: 1.1,
      do_sample: true,
      return_full_text: false,
    });

    const result = out[0].generated_text.trim();
    
    // Provide the single generated response as a variation
    self.postMessage({ status: 'complete', variations: [result] });
  } catch (err: any) {
    self.postMessage({ status: 'error', error: err.message });
  }
});
