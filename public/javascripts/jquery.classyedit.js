/*!
 * jQuery ClassyEdit
 * http://www.class.pm/projects/jquery/classyedit
 *
 * Copyright 2012 - 2013, Class.PM www.class.pm
 * Written by Marius Stanciu - Sergiu <marius@picozu.net>
 * Licensed under the GPL Version 3 license.
 * Version 1.1.0
 *
 */

(function(a) {
    debugme = function(a, e) {
        a && console.log(a);
        e && alert(e)
    };
    triggerclick = function() {
        debugme("click triggered");
        thiselement = window.getSelection().focusNode.parentNode;
        a(thiselement).trigger("click")
    };
    a.fn.ClassyEdit = function(c) {
        var e, h, i = ["start"], f = a(this);
        "undefined" == typeof a.fn.ClassyEdit.counter ? a.fn.ClassyEdit.counter = 1 : a.fn.ClassyEdit.counter++;
        for (var b = a.fn.ClassyEdit.counter, c = a.extend({
            animation: !0,
            buttons: "bold italic underline insertUnorderedList href html".split(" ")
        }, c), g = '<div class="classyedit" classyeditor="' + b + '"><div class="toolbar">', j = 0; j < c.buttons.length; j++)
            firstline = 0 == j ? " first" : "", g = g + '<div class="button' + firstline + '"><a href="#" command="' + c.buttons[j] + '"></a></div>';
        g = g + '</div><div class="editor" contenteditable="true">' + f.val() + '</div><textarea class="html_editor">' + f.val() + "</textarea></div>";
        f.hide();
        f.after(g);
        e = a("[classyeditor='" + b + "'] [contenteditable]");
        !1 == c.animation && (a("[classyeditor='" + b + "'] .toolbar").show(), a("[classyeditor='" + b + "'] .editor").css("marginTop", "-6px"));
        a("[classyeditor='" + b + "'] .editor").focus(function() {
            if (c.animation == true) {
                debugme("open toolbar: " + h);
                clearTimeout(h);
                a(this).parent().find(".toolbar").slideDown("fast");
                a(this).css("marginTop", "-6px")
            }
        });
        a("[classyeditor='" + b + "'] .editor").focusout(function() {
            if (c.animation == true) {
                var a = jQuery(this);
                h = setTimeout(function() {
                    a.parent().find(".toolbar").slideUp("fast");
                    a.css("marginTop", "0px")
                }, 100)
            }
        });
        a("[classyeditor='" + b + "'] .html_editor").focus(function() {
            a(this).parent().find(".toolbar").slideDown("fast")
        });
        a("[classyeditor='" + b + "'] [contenteditable]").focus(function() {
            e = this
        });
        a("[classyeditor='" + b + "'] [contenteditable]").keyup(function() {
            triggerclick()
        });
        a("[classyeditor='" + b + "'] [contenteditable]").click(function() {
            cleantoolbar(b)
        });
        a("[classyeditor='" + b + "'] [contenteditable]").focusout(function() {
            f.val(a(this).html());
            a("[classyeditor='" + b + "'] .html_editor").val(a(this).html());
            a("[classyeditor='" + b + "'] .html_editor").css("height", a(this).height())
        });
        a("[classyeditor='" + b + "'] .button a").click(function(a) {
            a.preventDefault()
        });
        cleantoolbar = function(b) {
            a("[classyeditor='" + b + "'] [command]").each(function() {
                jQuery.inArray(a(this).attr("command"), i) > 0 ? a(this).parent().addClass("on") : a(this).parent().removeClass("on")
            });
            debugme("buttonson = " + i.join(" / ") + " (toolbar cleaned)");
            i = ["start"]
        };
        buttonstate = function(b, d, c) {
            if (d == "on") {
                a("[classyeditor='" + c + "'] [command='" + b + "']").parent().addClass("on");
                b != "html" && i.push(b)
            } else if (d == "off")
                a("[classyeditor='" + c + "'] [command='" + b + "']").parent().removeClass("on");
            else {
                debugme(c + " is on/off: " + a("[classyeditor='" + c + "'] [command='" + b + "']").parent().hasClass("on"));
                return a("[classyeditor='" + c + "'] [command='" + b + "']").parent().hasClass("on")
            }
        };
        a("[classyeditor='" + b + "'] [contenteditable]").delegate("b", "click", function() {
            buttonstate("bold", "on", b)
        });
        a("[classyeditor='" + b + "'] [contenteditable]").delegate("u", "click", function() {
            buttonstate("underline", "on", b)
        });
        a("[classyeditor='" + b + "'] [contenteditable]").delegate("i", "click", function() {
            buttonstate("italic", "on", b)
        });
        a("[classyeditor='" + b + "'] [contenteditable]").delegate("ul", "click", function() {
            buttonstate("insertUnorderedList", "on", b)
        });
        a("[classyeditor='" + b + "'] [contenteditable]").delegate("a", "click", function() {
            buttonstate("href", "on", b)
        });
        a("[classyeditor='" + b + "'] [command]").click(function() {
            var c = true, d = a(this).attr("command");
            debugme(d);
            if (e == null) {
                alert("Click an editable area first");
                return false
            }
            buttonstate(d, "", b) ? buttonstate(d, "off", b) : buttonstate(d, "on", b);
            if (d == "html") {
                clearTimeout(h);
                if (buttonstate(d, "", b) == true) {
                    a("[classyeditor='" + b + "'] [contenteditable]").hide();
                    a("[classyeditor='" + b + "'] .html_editor").show()
                }
                else {
                    a("[classyeditor='" + b + "'] [contenteditable]").html(a("[classyeditor='" + b + "'] .html_editor").val());
                    f.val(a("[classyeditor='" + b + "'] .html_editor").val());
                    a("[classyeditor='" + b + "'] [contenteditable]").show();
                    a("[classyeditor='" + b + "'] .html_editor").hide()
                }
                return true
            }
            if (d == "bold" || d == "italic" || d == "underline" || d == "href")
                try {
                    document.execCommand("styleWithCSS", 0, false)
                } catch (g) {
                    try {
                        document.execCommand("useCSS", 0, true)
                    } catch (i) {
                        try {
                            document.execCommand("styleWithCSS", false, false)
                        } catch (j) {
                            debugme("Unable to set style formatting.")
                        }
                    }
                }
            if (d == "href") {
                c = prompt("Type a url:", "http://");
                if (!c)
                    return false;
                d = "createLink"
            }
            clearTimeout(h);
            document.execCommand(d, false, c)
        })
    }
})(jQuery);