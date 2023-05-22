// @ts-nocheck

// Handle toolbar height changes

new ResizeObserver(_entries => {
    $("html").get(0).style.setProperty("--toolbar-height", $(".ql-toolbar").outerHeight() + "px");
}).observe(document.body);

// Handle artificial scrollbar

let scrollTimeout;

const scrollMediator = () => {
    clearTimeout(scrollTimeout);

    $(".margin-scrollbar").off("scroll", marginScroller);
    $(".ql-editor").off("scroll", editorScroller);

    scrollTimeout = setTimeout(() => {
        $(".ql-editor").on("scroll", editorScroller);
        $(".margin-scrollbar").on("scroll", marginScroller);
    }, 10);
}

const editorScroller = (ev) => {
    scrollMediator();

    $(".margin-scrollbar-inner").height($(".ql-editor").get(0).scrollHeight);
    $(".margin-scrollbar").scrollTop($(".ql-editor").scrollTop());
};

const marginScroller = (ev) => {
    scrollMediator();

    $(".margin-scrollbar-inner").height($(".ql-editor").get(0).scrollHeight);
    $(".ql-editor").scrollTop($(".margin-scrollbar").scrollTop());
};

$(".ql-editor").on("scroll", editorScroller);
$(".margin-scrollbar").on("scroll", marginScroller);

// Handle nav sidebar

$(".navbar-burger").click(function() {
  
    $(".navbar-burger").toggleClass("is-active");
    $(".navbar-menu").toggleClass("is-active");

});

// Handle keeping selection on nav use

$(".navbar-burger, .navbar-item").mousedown(() => {
    const selected = Muzzy.editor.getSelection();
    if (selected) {
        setTimeout(() => Muzzy.editor.setSelection(selected.index, selected.length), 1);
    }
});

// Initialize themes in nav

for (const theme of Muzzy.Themes.list) {
    $("#tooltip-themes").append(`<a class="navbar-item" onclick="Muzzy.Themes.set(this.innerHTML);">${theme}</a>`);
}

// Apply saved or default theme
Muzzy.Themes.set(Muzzy.Database.get("theme", Muzzy.Themes.list[0]));

// Handle nav popover

function popoverTippy(query) {
    tippy(query, {
        content(reference) {
            const query = reference.getAttribute('data-popover');
            const template = document.querySelector(query);
            return template.innerHTML;
        },
        allowHTML: true,
        placement: "right",
        maxWidth: 500,
        trigger: 'mouseenter',
        interactive: true,
        interactiveBorder: 20,
        appendTo: () => document.body,
        onCreate(instance) {
            $(instance.popper).addClass("navbar-is-popover");
            $(instance.popper).find(".tippy-box").css("background-color", "rgba(0, 0, 0, 0.9)");
            $(instance.popper).find(".tippy-arrow").css("color", "rgba(0, 0, 0, 0.9)");
        },
        onShow() {
            $(".navbar-is-popover").each((_i, e) => e._tippy.hide());
        }
    });
}
popoverTippy(".navbar-has-popover");

// Handle generic tooltips

tippy('[data-tooltip]', {
    content(reference) {
        return reference.getAttribute('data-tooltip');
    },
    placement: 'top',
    maxWidth: 500,
    trigger: 'custom',
    interactive: true,
    appendTo: () => document.body,
    onShow(instance) {
        $(instance.popper).find(".tippy-content").html($(instance.reference).attr("data-tooltip"));
    }
});

// Handle nav sidebar close on outside click
$(document).click((event) => {
    if ($(event.target).is("#sidebar, #sidebar *, .navbar-burger, .prevent-sidebar-close")) return;
    
    $(".navbar-burger").removeClass("is-active");
    $(".navbar-menu").removeClass("is-active");
    $(".navbar-is-popover").each((_i, e ) => e._tippy?.hide());
});

// Handle modals

$(document).click((event) => {
    if (!$(event.target).is("[data-open-modal]")) return;
    const query = $(event.target).attr("data-open-modal");
    
    if (query == "#muzzy-error-report") {
        // Start error report generation

        Muzzy.Errors.generateReport();
    }

    $(query).modal({
        fadeDuration: 200,
        fadeDelay: 0.5
    });
});

// Handle nav functions

    // Open File

Muzzy.Nav.openAsMuzzy = () => {
    const rawData = prompt((`
At the moment, support for opening files is limited to .muzzy files, which can be downloaded in the Muzzy app. This limited support will be vastly broadened in the next update, and this opening process will also be made much simpler.\n\n
Instructions:\n
1. Find the .muzzy file that you have previously downloaded and want to open\n
2. Right click the file, select Open With, and select Notepad\n
3. Use Ctrl+A to select all of the text in the file, and use Ctrl+C to copy it\n
4. Return to this webpage and paste in the below textbox using Ctrl+V\n
5. Press OK`).trim());

    if (!rawData) return;

    try {
        const data = Muzzy.fromMuzzyFile(rawData);
        if (!data.ops) throw new Error();
        Muzzy.editor.setContents(data);
        Muzzy.__editorSaveCallback();
        alert("Successfully loaded the .muzzy file!");
    }
    catch {
        alert("Failed to load the .muzzy file...");
    }
}

    // Download .docx

Muzzy.Nav.downloadAsMuzzy = () => {
    const url = URL.createObjectURL(new Blob([ Muzzy.toMuzzyFile() ], {type: "text/plain"}));
    const downloader = document.createElement('a');
    downloader.setAttribute('href', url);
    downloader.setAttribute('download', `your_doc.muzzy`);
    downloader.style.display = 'none';
    document.body.appendChild(downloader);
    downloader.click();
    document.body.removeChild(downloader);
}

Muzzy.Nav.showThemes = () => {
    Muzzy.dynamicTooltip($("#tooltip-themes").html());
}

Muzzy.Nav.disableErrors = (elem) => {
    Muzzy.Errors.toggleChecking();
    $(elem).attr("onclick", "Muzzy.Nav.enableErrors(this);");
    $(elem).html("Enable Error Checks");
}

Muzzy.Nav.enableErrors = (elem) => {
    Muzzy.Errors.toggleChecking();
    $(elem).attr("onclick", "Muzzy.Nav.disableErrors(this);");
    $(elem).html("Disable Error Checks");
}

Muzzy.Nav.showIgnoredErrors = (elem) => {
    document.querySelectorAll(".muzzy-error[error-ignore=true]").forEach(e => Muzzy.Errors.unignore(e));
    $(elem).attr("onclick", "Muzzy.Nav.hideIgnoredErrors(this);");
    $(elem).html("Hide Ignored Errors");
};

Muzzy.Nav.hideIgnoredErrors = (elem) => {
    document.querySelectorAll(".muzzy-error[error-ignore=false]").forEach(e => Muzzy.Errors.ignore(e));
    $(elem).attr("onclick", "Muzzy.Nav.showIgnoredErrors(this);");
    $(elem).html("Show Ignored Errors");
}

    // Insert References
    // Insert Templates