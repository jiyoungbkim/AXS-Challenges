import { cloudflare } from '@cloudflare/vite-plugin';
import { flue, flueWorkerConfig } from '@flue/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [flue(), cloudflare({ config: flueWorkerConfig() })],
	// hoksiyo-frontend's dev server reaches this one over the BACKEND service
	// binding with Host: hoksiyo-backend, which Vite blocks by default.
	server: { allowedHosts: ['hoksiyo-backend'] },
});
