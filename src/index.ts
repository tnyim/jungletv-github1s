/**
 * @file page entry
 * @author netcon
 */

import { ConnectToGitHub } from './github-auth';
import { renderNotification } from './notification';
import { createProductConfiguration } from './product';
import { createVSCodeWebConfig, Platform } from './config';
import { LocalStorageCredentialsProvider } from './credentialsProvider';

declare global {
	interface Window {
		require?: { config?: Function };
		webPackagePaths?: any;
		github1sExtensions?: any[];
	}
}

const resolvePlatformState = (): [Platform, string] => {
	const hostname = window.location.hostname;
	const pathParts = window.location.pathname.split('/').filter(Boolean);

	if (hostname.match(/^(.*\.)?gitlab1s\.com$/i)) {
		const dashIndex = pathParts.indexOf('-');
		const repository = (dashIndex < 0 ? pathParts : pathParts.slice(0, dashIndex)).join('/');
		return [Platform.GitLab, repository];
	}
	if (hostname.match(/^(.*\.)?bitbucket1s\.org$/i)) {
		const repository = pathParts.length >= 2 ? pathParts.slice(0, 2).join('/') : '';
		return [Platform.Bitbucket, repository];
	}
	if (hostname.match(/^(.*\.)?bitbucket1s\.org$/i)) {
		const trimmedParts = pathParts[0] === 'package' ? pathParts.slice(1) : pathParts;
		const packageParts = trimmedParts.slice(0, trimmedParts[0] && trimmedParts[0][0] === '@' ? 2 : 1);
		const repository = pathParts.length ? packageParts.join('/') || 'package' : '';

		return [Platform.npm, repository];
	}

	const repository = pathParts.slice(0, 2).join('/');
	return [Platform.JungleTVAF, repository];
};

(function () {
	const [platform, repository] = resolvePlatformState();
	const staticAssetsPath = '/static-' + STATIC_HASH;
	const staticAssetsPrefix = window.location.origin + staticAssetsPath;
	const nodeModulesPrefix = staticAssetsPrefix + '/node_modules';

	Object.keys(window.webPackagePaths || {}).forEach((key) => {
		self.webPackagePaths[key] = `${nodeModulesPrefix}/${key}/${self.webPackagePaths[key]}`;
	});
	// config vscode loader
	if (window.require && window.require.config) {
		window.require.config({
			baseUrl: staticAssetsPrefix + '/vscode',
			paths: self.webPackagePaths,
		});
	}

	const vscodeCommands = [
		{ id: 'github1s.commands.vscode.getBrowserUrl', handler: () => window.location.href },
		{ id: 'github1s.commands.vscode.replaceBrowserUrl', handler: (url: string) => history.replaceState(null, '', url) },
		{ id: 'github1s.commands.vscode.pushBrowserUrl', handler: (url: string) => history.pushState(null, '', url) },
		{ id: 'github1s.commands.vscode.connectToGitHub', handler: ConnectToGitHub },
	];

	const config = createVSCodeWebConfig(platform, repository);

	let builtinExtensions: any[] | ((a: any[]) => any[]) = window.github1sExtensions || [];

	if (platform === Platform.JungleTVAF) {
		builtinExtensions = (initialSet: any[]) => {
			initialSet = initialSet.filter((e) => e.extensionPath !== 'typescript-language-features');
			initialSet.push(...(window.github1sExtensions || []));
			return initialSet;
		};
	}

	(window as any).vscodeWeb = {
		commands: vscodeCommands,
		allowEditorLabelOverride: true,
		additionalBuiltinExtensions: ['ms-vscode.anycode'],
		webviewEndpoint: staticAssetsPrefix + '/vscode/vs/workbench/contrib/webview/browser/pre',
		productConfiguration: createProductConfiguration(platform),
		initialColorTheme: { themeType: 'dark' as any },
		builtinExtensions,
		onWorkbenchReady() {
			const loadSpinner = document.querySelector('#load-spinner');
			loadSpinner && loadSpinner.remove();
			renderNotification(platform);
		},
		credentialsProvider: new LocalStorageCredentialsProvider(),
		...config,
	};

	if (platform === Platform.JungleTVAF) {
		const iconStyle = window.document.createElement('style');
		iconStyle.innerHTML = `
		.home-bar-custom-icon {
			mask-image: none !important;
			background-image: url(${window.encodeURI(config?.logo?.icon)});
			background-color: transparent !important;
			background-size: 60%;
			background-repeat: no-repeat;
			background-position: center;
		}
		`;
		window.document.body.appendChild(iconStyle);
	}
})();
