const path = require('path');
const fs = require('fs-extra');
const cp = require('child_process');
const webpack = require('webpack');
const CleanCSS = require('clean-css');
const UglifyJS = require('uglify-js');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const generate = require('generate-file-webpack-plugin');
const packUtils = require('./scripts/webpack.js');

const GIT_COMMIT_ID = cp.execSync('git rev-parse HEAD').toString().trim();
const STATIC_HASH = GIT_COMMIT_ID.padStart(7, '0').slice(0, 7);
const devVscode = !!process.env.DEV_VSCODE;
const skipMinified = { info: { minimized: true } };

const VSCODE_NODE_MODULES = [
	'@vscode/iconv-lite-umd',
	'@vscode/vscode-languagedetection',
	'@xterm/addon-canvas',
	'@xterm/addon-image',
	'@xterm/addon-search',
	'@xterm/addon-serialize',
	'@xterm/addon-unicode11',
	'@xterm/addon-webgl',
	'@xterm/xterm',
	'jschardet',
	'tas-client-umd',
	'vscode-oniguruma',
	'vscode-textmate',
].map((pkg) => ({
	from: `vscode-web/node_modules/${pkg}/**`,
	globOptions: { dot: true },
	to({ context, absoluteFilename }) {
		const relativePath = path.relative(context, absoluteFilename);
		const relativeDir = path.dirname(relativePath.replace('vscode-web' + path.sep + 'node_modules' + path.sep, ''));
		return `static-${STATIC_HASH}/node_modules/${relativeDir}/[name][ext]`;
	},
	...skipMinified,
}));

module.exports = (env, argv) => {
	const devMode = argv.mode === 'development';
	const minifyCSS = (code) => (devMode ? code : new CleanCSS().minify(code).styles);
	const minifyJS = (code) => (devMode ? code : UglifyJS.minify(code).code);

	return {
		mode: env.mode || 'production',
		entry: path.resolve(__dirname, 'src/index.ts'),
		output: { filename: `static-${STATIC_HASH}/config/bootstrap.js` },
		resolve: { extensions: ['.js', '.ts'] },
		module: {
			rules: [
				{ test: /\.tsx?$/, use: 'ts-loader' },
				{ test: /\.css?$/, use: ['style-loader', 'css-loader'] },
				{ test: /\.svg$/, use: 'file-loader' },
			],
		},
		plugins: [
			new CopyPlugin({
				patterns: [
					{ from: 'public/favicon*', to: '[name][ext]' },
					{ from: 'public/manifest.json', to: '[name][ext]' },
					{ from: 'public/robots.txt', to: '[name][ext]' },
					{
						from: 'extensions',
						to: `static-${STATIC_HASH}/extensions`,
						globOptions: { dot: true, ignore: ['**/node_modules/**'] },
						...skipMinified,
					},
					!devVscode && {
						from: 'node_modules/@github1s/vscode-web/dist/vscode',
						to: `static-${STATIC_HASH}/vscode`,
						...skipMinified,
					},
					!devVscode && {
						from: 'node_modules/@github1s/vscode-web/dist/extensions',
						to: `static-${STATIC_HASH}/extensions`,
						...skipMinified,
					},
					...VSCODE_NODE_MODULES,
				].filter(Boolean),
			}),
			new HtmlWebpackPlugin({
				inject: false,
				template: 'public/index.html',
				templateParameters: {
					devVscode: devVscode,
					staticHash: STATIC_HASH,
					spinnerStyle: minifyCSS(fs.readFileSync('./public/spinner.css').toString()),
					pageTitleScript: minifyJS(fs.readFileSync('./public/page-title.js').toString()),
				},
			}),
			new webpack.DefinePlugin({
				STATIC_HASH: JSON.stringify(STATIC_HASH),
				GITHUB_ORIGIN: JSON.stringify(process.env.GITHUB_DOMAIN || 'https://github.com'),
				GITLAB_ORIGIN: JSON.stringify(process.env.GITLAB_DOMAIN || 'https://gitlab.com'),
			}),
			generate({
				file: `static-${STATIC_HASH}/config/extensions.js`,
				content: packUtils.createExtensionsContent(devVscode),
			}),
		],
		performance: false,
		devServer: {
			port: 5000,
			https: true,
			liveReload: false,
			allowedHosts: 'all',
			static: {
				directory: path.join(__dirname, 'dist'),
			},
			client: {
				progress: true,
			},
			historyApiFallback: {
				rewrites: [{ from: /./, to: '/index.html' }],
			},
			devMiddleware: {
				writeToDisk: true,
			},
			proxy: {
				'/api/vscode-unpkg': packUtils.createVSCodeUnpkgProxy(),
			},
		},
	};
};
