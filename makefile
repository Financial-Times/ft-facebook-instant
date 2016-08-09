export SHELL := /bin/bash

HEROKU := $(shell command -v heroku 2> /dev/null)

ifdef HEROKU
	-include scripts/env.mk
endif

SRC = server
LIB = build
TEST = test
SRC_FILES = $(shell find $(SRC) -name '*.js')
LIB_FILES = $(patsubst $(SRC)/%.js, $(LIB)/%.js, $(SRC_FILES))
LIB_DIRS = $(dir $(LIB_FILES))
TEST_FILES = $(shell find $(TEST) -name '*.js')
TEST_DIRS = $(dir $(TEST_FILES))
TEST_UTILS = $(shell find test-utils -name '*.js')

NPM_BIN := $(shell npm bin)

BABEL = $(NPM_BIN)/babel
BABEL_OPTS =

ESLINT = $(NPM_BIN)/eslint
ESLINT_OPTS = --fix

LINTSPACE = $(NPM_BIN)/lintspaces
LINTSPACE_OPTS = -n -d tabs -l 2

MOCHA = $(NPM_BIN)/mocha
MOCHA_OPTS = --compilers js:babel-register

HEROKU_CONFIG_TO_ENV = $(NPM_BIN)/heroku-config-to-env
HEROKU_CONFIG_OPTS = -i HEROKU_ -i REDIS_URL -i NODE_ENV -l REDIS_URL=redis://localhost:6379/ -l NODE_ENV=development
HEROKU_CONFIG_APP = ft-facebook-instant-staging

all: babel

babel: $(LIB) $(LIB_DIRS) $(LIB_FILES)

$(LIB)/%.js: $(SRC)/%.js
	$(BABEL) $(BABEL_OPTS) $< -o $@

$(LIB)/%: $(SRC)/% clean-$(LIB)/%
	mkdir -p $@

$(LIB): $(SRC)
	mkdir -p $@

clean-$(LIB)/%:
	$(eval LIB_THINGS := $(patsubst $(LIB)/%, %, $(wildcard $(LIB)/$*/*)))
	$(eval SRC_THINGS := $(patsubst $(SRC)/%, %, $(wildcard $(SRC)/$*/*)))
	$(eval TO_DELETE := $(addprefix $(LIB)/, $(shell comm -23 <(echo $(LIB_THINGS) | tr ' ' '\n' | sort) <(echo $(SRC_THINGS) | tr ' ' '\n' | sort))))
	$(if $(TO_DELETE), rm -rf $(TO_DELETE))

clean:
	rm -rf $(LIB)

lintspace: $(LINTSPACE_FILES)
	$(LINTSPACE) $(LINTSPACE_OPTS) $^

lint: $(SRC_FILES) $(TEST_FILES) $(TEST_UTILS)
	$(ESLINT) $(ESLINT_OPTS) $^

test: lint lintspace babel $(TEST_DIRS) $(TEST_FILES) $(TEST_UTILS)
	$(MOCHA) $(MOCHA_OPTS) test/**/*.js

ab-integration-test: babel
	scripts/ab-integration-test.sh

$(TEST)/stylesheets/%.js: $(SRC)/stylesheets/%.xsl
	@: # dummy target just to inform watch-make

# local config
scripts/env.sh:
	$(HEROKU_CONFIG_TO_ENV) $(HEROKU_CONFIG_OPTS) $(HEROKU_CONFIG_APP) $@

scripts/env.mk: scripts/env.sh
	sed 's/"//g ; s/=/:=/' < $< > $@

.PHONY: clean lint lintspace test
