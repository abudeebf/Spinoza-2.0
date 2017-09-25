# -*- coding: utf-8 -*-
#


"""Editor Class represents an Ace+JQuery Brython editor Object."""


import sys
import time
import traceback

from browser import document, window
from javascript import console, JSObject


###############################################################################


class Editor:
    def __init__(self, tab_container='tt'):
        self._editors = {}
        self._tabcount = 0
        self._tab_container = '\#%s' % tab_container
        self._jquery = JSObject(window.jQuery)
        self._jquery(self._tab_container).tabs()

    def add_editor(self, filename=None, content=""):
        if filename is None:
            filename = "Untitled-%s" % self._tabcount
            self._tabcount += 1
        _content = '<div id="%s" class="editclass" style="width:100%%;height:100%%">%s</div>'
        self._jquery(self._tab_container).tabs('add', {
            'title': filename,
            'content': _content % (filename, content),
            'closable': True
        })
        #add ace editor to filename pre tag
        _editor = JSObject(window.ace).edit(filename)
        _session = _editor.getSession()
        _session.setMode("ace/mode/python")
        #_editor.setTheme("ace/theme/crimson_editor")
        #_session.setMode("ace/mode/python")
        #_session.setUseWrapMode(true)
        #_session.setTabSize(4)
        _editor.setOptions({
            'enableLiveAutocompletion': True,
            'enableSnippets': True,
            'highlightActiveLine': False,
            'highlightSelectedWord': True
        })
        _editor.focus()

        self._editors[filename] = _editor
        #set resize
        document[filename].bind('resize', lambda x: self._editors[filename].resize(True))
        
    def getCurrentTabName(self):
        _tab = self._jquery(self._tab_container).tabs('getSelected')
        return _tab.panel('options').title

    def setCurrentTabName(self, name):
        _currentName = self.getCurrentTabName()
        _tab = self._jquery(self._tab_container).tabs('getSelected')
        self.add_editor(filename=name, content=self.getCurrentText())
        _tab = self._jquery(self._tab_container).tabs('close', _currentName)
        del self._editors[_currentName]

    def getCurrentText(self):
        _title = self.getCurrentTabName()
        return self._editors[_title].getValue()

    # Load a Python script
    def load_filename(self, filename):
        # Need to load file from google drive.
        self._add_editor(filename, "this is the contents for %s" % filename)

    def clearCurrentText(self):
        _title = self.getCurrentTabName()
        return self._editors[_title].setValue('')

    def setCurrentText(self,code):
         _title = self.getCurrentTabName()
         return self._editors[_title].setValue(code);
###############################################################################


def write(data):
    document["pyconsole"].value += '%s' % data


sys.stdout.write = write
sys.stderr.write = write


if __name__ == '__main__':
   print(__doc__)
