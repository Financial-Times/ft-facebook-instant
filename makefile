SHELL := /bin/bash

SRC = server
LIB = build
SRC_FILES = $(shell find $(SRC) -name '*.js')
LIB_FILES = $(patsubst $(SRC)/%.js, $(LIB)/%.js, $(SRC_FILES))
LIB_DIRS = $(dir $(LIB_FILES))

BABEL = node_modules/.bin/babel
BABEL_OPTS = --presets es2015

all: babel

babel: $(LIB_DIRS) $(LIB_FILES)

$(LIB)/%.js: $(SRC)/%.js
	$(BABEL) $(BABEL_OPTS) $< -o $@

$(LIB)/%: $(SRC)/% clean-$(LIB)/%
	mkdir -p $@

clean-$(LIB)/%:
	$(eval LIB_THINGS := $(patsubst $(LIB)/%, %, $(wildcard $(LIB)/$*/*)))
	$(eval SRC_THINGS := $(patsubst $(SRC)/%, %, $(wildcard $(SRC)/$*/*)))
	$(eval TO_DELETE := $(addprefix $(LIB)/, $(shell comm -23 <(echo $(LIB_THINGS) | tr ' ' '\n' | sort) <(echo $(SRC_THINGS) | tr ' ' '\n' | sort))))
	$(if $(TO_DELETE), rm $(TO_DELETE))

clean:
	rm -rf $(LIB)

.PHONY: clean
