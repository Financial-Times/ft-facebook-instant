include vars.mk

all: $(LIB_FILES)

$(LIB)/%.js: $(SRC)/%.js
	@echo $<
