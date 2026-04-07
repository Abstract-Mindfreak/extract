from labthings.extensions import BaseExtension
from labthings.utilities import path_relative_to
from openflexure_microscope.api.utilities.gui import build_gui

class BlocklyExtension(BaseExtension):

    def __init__(self):
        super().__init__(
            "org.openflexure.blockly",
            version = "0.0.0",
            static_folder = path_relative_to(__file__,"static"),
        )

        def gui_func():
            return {"icon": "extension", "frame": {"href": self.static_file_url("extension_index.html")}}

        self.add_meta("gui", build_gui(gui_func, self))

LABTHINGS_EXTENSIONS = [BlocklyExtension]

