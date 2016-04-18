SHELL := /bin/bash

-include scripts/env.mk

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

all: babel

makefile: scripts/env.mk
	$(eval include scripts/env.mk)

%.mk: %.sh
	cat $< | sed 's/=/:=/ ; s/"//g' > $@

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

$(TEST)/stylesheets/%.js: $(SRC)/stylesheets/%.xsl
	@: # dummy target just to inform watch-make

.PHONY: clean lint lintspace test
