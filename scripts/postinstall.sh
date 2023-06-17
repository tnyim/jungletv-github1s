#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${0}")/.."
APP_ROOT=$(pwd)

function main() {
	# install github1s extensions dependencies
	for entry in "${APP_ROOT}/extensions"/*
	do
		if [ -f "$entry/package.json" ] && [ ! -f "$entry/do_not_compile" ]
		then
			cd $entry
			yarn --frozen-lockfile
		fi
	done

	# install dependencies for the @github1s/vscode-web
	cd "${APP_ROOT}/vscode-web"
	yarn --frozen-lockfile
}

main "$@"
