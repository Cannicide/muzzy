// @ts-nocheck

/* Existing modules customization */

const FontAttributor = Quill.import('attributors/style/font');
FontAttributor.whitelist = [
  "Sans-Serif", "Times New Roman"
];
Quill.register(FontAttributor, true);

// if adding custom font sizes, use derivation of: https://stackoverflow.com/a/69640932/6901876

/* New modules customization */

const Inline = Quill.import('blots/inline');
const Delta = Quill.import("delta");

class MuzzyErrorBlot extends Inline{    

    static create(opts){
        let node = super.create();
        if (opts.value != null) $(node).html(opts.value);
        $(node).addClass("muzzy-error"); // Allow styling the error element
        $(node).attr("error", opts.id); // Identify ID of the error, used by popover
        $(node).attr("type", Muzzy.Errors.list[opts.id].type); // Identify type of error, for styling purposes
        $(node).attr("error-ignore", "never"); // Initialize with error not being ignored
        Muzzy.Errors.createPopover(node); // Initialize popover for this error
        return node;
    }

    static formats(node) {
        // Gets initial error value (when HTML is directly inserted into editor)
        return {
            value: null,
            id: $(node).attr("error")
        };
    }

    static value(node) {
        // Returns output data for errors, to be saved 
        return {
            value: node.innerHTML,
            id: $(node).attr("error")
        }
    }
}

MuzzyErrorBlot.blotName = 'muzzyerror';
MuzzyErrorBlot.tagName = 'muzzyerror';
Quill.register(MuzzyErrorBlot);

/* Initialize editor */

Muzzy.editor = new Quill('#editor', {
    theme: 'snow',
    placeholder: "Start typing or paste your essay...",
    modules: {
        history: {
            delay: 2000
        },
        toolbar: [
            [{header:[]}], [{font:FontAttributor.whitelist}],
            ["bold", "italic", "underline", {color:[]}, {background:[]}],
            ["link", {script:"super"}, {script:"sub"}],
            [{align:[]}, {list:"bullet"}, {list:"ordered"}],
            ["clean"]
        ],
        keyboard: {
            bindings: {
                /* Prevent newlines within muzzyerrors */
                enter: {
                    key: "enter",
                    handler: (range, context) => {
                        if (context.format.muzzyerror) {
                            
                            const [leaf, offset] = Muzzy.editor.getLeaf(range.index);
                            const length = leaf?.text?.length;

                            if (length) Muzzy.editor.removeFormat(range.index - offset, length, "silent");
                        }
                        return true;
                    }
                }
            }
        }
    }
});

$(".editor-unloaded").removeClass("editor-unloaded");
Muzzy.editorLoad();

/* Set font-family in toolbar on selection change */

Muzzy.editor.on("selection-change", (range) => {
    if (!range) return true;

    const format = {
        font: "Sans-Serif",
        ...Muzzy.editor.getFormat(range.index - 1, 1)
    };
    
    $(".ql-font > .ql-picker-label").attr("data-value", format.font);
});

/* Disable built-in browser spellcheck, in favor of Muzzy grammar and spelling checks */

$(Muzzy.editor.root).attr("spellcheck", "false");

/* Automatically check errors in editor on text change, and update footer counts */

if (Muzzy.Errors.checksEnabled) {
    Muzzy.Errors.check();
    Muzzy.Errors.updateErrorCount();
}

$(".footer-words").html(Muzzy.editor.getText().split(" ").length);
$(".footer-chars").html(Muzzy.editor.getLength() - 1);
Muzzy.editor.history.clear();

let checkTimeout;
const checkCallback = (delta) => {
    const ops = delta.ops;
    Muzzy.editorSave();

    if (Muzzy.Errors.checksEnabled) {
        // Remove existing errors to replace with new errors
        Muzzy.editor.updateContents(new Delta()
            .retain(Muzzy.editor.getLength(), { muzzyerror: false }),  // Removes muzzyerror formatting from this segment of text
            "silent"
        );

        const currErrors = Muzzy.Errors.check();
        Muzzy.Errors._ignoredErrors = Muzzy.Errors._ignoredErrors.filter(prevErr => {
            // Because removing errors also removes ignored error elements, this snippet re-ignores them

            if (ops[1]?.delete && ops[0]?.retain < prevErr.index) prevErr.index -= 1;
            else if (ops[1]?.insert && ops[0]?.retain <= prevErr.index) prevErr.index += 1;

            const currEquiv = currErrors.find(currErr => currErr.index == prevErr.index && currErr.errorId == prevErr.errorId);
            if (currEquiv) {
                const elem = Muzzy.getElemFromIndex(currEquiv.index);
                prevErr.elem = elem;
                $(elem).attr("error-ignore", true);
                return true;
            }
            else {
                return false;
            }
        });

        Muzzy.Errors.updateErrorCount();

        // Prevent cursor styling on enter/backspace
        setTimeout(() => {
            $("muzzyerror").has(".ql-cursor").remove();
        }, 1);
    }

    $(".footer-words").html(Muzzy.editor.getText().split(" ").length);
    $(".footer-chars").html(Muzzy.editor.getLength() - 1);
    $("*[data-tippy-root]").get(0)?._tippy.hide();
    Muzzy.editor.history.clear();
};

Muzzy.editor.on('text-change', (delta) => {
    clearTimeout(checkTimeout);
    checkTimeout = setTimeout(() => checkCallback(delta), 10);
});

Muzzy.editor.keyboard.addBinding({
    key: 191,
    shortKey: true,
    handler(range, context) {
        if (!context.format.muzzyerror) return true;

        const elem = Muzzy.getElemFromIndex(range.index);
        if (!elem) return true;

        if (Muzzy.Errors.isIgnored(elem)) {
            Muzzy.Errors.unignore(elem);
        }
        else {
            elem._tippy?.hide();
            Muzzy.Errors.ignore(elem);
        }

        return true;
    }
})