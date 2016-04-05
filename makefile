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

$(LIB)/%: $(SRC)/%
	mkdir -p $@

clean:
	rm -rf $(LIB)

.PHONY: clean
