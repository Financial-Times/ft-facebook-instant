#!/bin/sh

{
	git ls-files | egrep '\.(html|js|json|scss|sh|xsl)$' | egrep -v '(package|bower|app).json' | xargs lintspaces -n -d tabs -l 2
} && {
	git ls-files | egrep '\.js$' | xargs eslint --fix
}
