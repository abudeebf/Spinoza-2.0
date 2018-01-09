window._custom_VFS={"FileSystemBase": "import json\nfrom javascript import console\nimport FileObject\n#from .FileObject import FileObject\n#from . import FileObject\n\nimport datetime\n\nunique_id=0\n\nclass FileSystemNode:\n  def __init__(self, name):\n      global unique_id\n      self.unique_id=unique_id\n      unique_id+=1\n      self._isa_dir=False\n      self._isa_file=False\n      self.children=[]\n      self.name=name\n      self.modified_date='1900-01-01'\n      self.fullname=None\n\n  def isa_dir(self):\n      return self._isa_dir\n\n  def children(self):\n      return self.children\n\n  def get_child(self, name):\n      for _child in self.children:\n          if _child.name == name:\n             return _child\n\n      #if we get here, there is no child by that name\n      _child=FileSystemNode(name)\n      self.children.append(_child)\n      return _child\n\nclass FileSystem:\n  def __init__(self, root='/'):\n      self._root=root\n\n  def _prefix_check(self, name):\n      if name.startswith(self._root):\n         return name\n\n      if name.startswith('/'):\n         name=name[1:]\n\n      return \"%s/%s\" % (self._root, name)\n\n  def _list_files(self):\n      \"\"\" returns a list of files this person has on storage,\n          return None if unsuccessful\n      \"\"\"\n      pass\n\n  def _read_file(self, filename):\n      \"\"\" retrieves file from storage, returns fileobj if successful,\n          return None if unsuccessful\n      \"\"\"\n      pass\n\n  def _write_file(self, fileobj):\n      \"\"\"saves a file to storage, returns True if save was successful,\n         False, if unsuccessfull\n      \"\"\"\n      pass\n\n  def _rm_file(self, filename):\n      \"\"\"removes a file in storage, returns True if delete was successful,\n         False, if unsuccessfull\n      \"\"\"\n      pass\n\n  def _modified_date(self, filename):\n      \"\"\" returns a file's last modification date,\n          for some implementations, this could be an expensive operation\n          if so, just return a date such as '1900-01-01'\n      \"\"\"\n      return 1\n\n  def listdir(self, directory, callback):\n      directory=self._prefix_check(directory)\n\n      #_filenames=self._list_files()\n      _results=self._list_files()\n      if _results['status'] == 'Error':\n         _results['filelist']=[]\n         callback(_results)\n         return\n\n      _root=FileSystemNode(name='/')\n      _root._isa_dir=True\n\n      _files=_results['filelist']\n      #console.log(_files)\n      for _file in _files:\n          _fullname=_file['filename']\n          if _fullname.startswith(directory):\n             _filename=_fullname[len(directory):]\n             _dirs=_filename.split('/')\n\n             _pos=_root\n             for _dir in _dirs:\n                 _pos=_pos.get_child(_dir)\n                 _pos._isa_dir=_dir != _dirs[-1]\n                 _pos._isa_file=not _pos._isa_dir\n\n                 if _pos._isa_file:\n                    _pos.fullname=_fullname\n                    _tstamp=_file.get('modified_date',\n                                      self._modified_date(_fullname))\n                    if not isinstance(_tstamp, (int,)):\n                       _tstamp=1\n                    #console.log(_tstamp)\n                    _md=datetime.datetime.fromtimestamp(_tstamp)\n                    #console.log(str(_md))\n                    _pos.modified_date=str(_md)\n      \n      callback({'status': 'Okay', 'filelist': _root})\n\n  def read_file(self, filename, callback):\n      filename=self._prefix_check(filename)\n      callback(self._read_file(filename))\n\n  def save_file(self, fileobj, callback):\n      assert isinstance(fileobj, FileObject.FileObject)\n      #assert isinstance(fileobj, FileObject)\n\n      _filename=fileobj.get_filename()\n      assert _filename is not None\n\n      _filename=self._prefix_check(_filename)\n      fileobj.set_filename(_filename) #the name may have changed\n      #fix me  brython issue  _time.mktime\n      #fileobj.set_attribute('modified_date', int(datetime.datetime.now().timestamp()))\n      fileobj.set_attribute('modified_date', 1412391232)\n      callback(self._write_file(fileobj))\n\n  def rm_file(self, filename, callback):\n      filename=self._prefix_check(filename)\n      callback(self._rm_file(filename))\n", "Authentication": "class Authentication:\n  def __init__(self, userid, password):\n      self._userid=userid\n      self._password=password\n\n      self._token=None\n\n  def get_token(self):\n      return self._token\n\n  def set_token(self, token):\n      self._token=token\n", "local_storage_fs": "from browser.local_storage import storage\nimport FileSystemBase\nimport FileObject\n\nimport json\nfrom javascript import console\n\nclass FileSystem(FileSystemBase.FileSystem):\n  def __init__(self, root):\n      FileSystemBase.FileSystem.__init__(self, root)\n\n  def _list_files(self):\n      \"\"\" returns a list of files this person has on storage,\n          return empty list [] if unsuccessful\n      \"\"\"\n\n      _list=[]\n      for _file in storage.keys():\n          if not _file.startswith('/pyschool'): continue\n          try:\n            _fileobj=FileObject.FileObject()\n            #_fileobj=FileSystemBase.FileObject()\n            _fileobj.from_json(storage[_file])\n          except Exception as e:\n            #not a FileObject file..\n            console.log(str(e))\n            console.log('not a fileobject...', _file)\n            continue\n\n          _list.append({'filename': _fileobj.get_filename(), \n                        'modified_date': _fileobj.get_attribute('modified_date')})\n\n      return {'status': 'Okay', 'filelist': _list}\n\n  def _read_file(self, filename):\n      \"\"\" retrieves file from storage, returns fileobj if successful,\n          return None if unsuccessful\n      \"\"\"\n      try:\n        _json=storage[filename]\n      except KeyError:\n        return {'status': 'Error', 'message': 'File doesn''t exist'}\n\n      _f=FileObject.FileObject()\n      #_f=FileSystemBase.FileObject()\n      _f.from_json(_json)\n      return {'status': 'Okay', 'fileobj': _f}\n\n  def _write_file(self, fileobj):\n      \"\"\"saves a file to storage, returns True if save was successful,\n         False, if unsuccessful\n      \"\"\"\n   \n      try:\n         storage[fileobj.get_attribute('filename')] = fileobj.to_json()\n      except Exception as e:\n         return {'status': 'Error', 'message': str(e)}\n\n      return {'status': 'Okay', 'message': 'File Saved...'}\n      \n\n  def _rm_file(self, filename):\n      \"\"\"removes a file in storage, returns True if delete was successful,\n         False, if unsuccessfull\n      \"\"\"\n      try:\n         del storage[filename]\n      except Exception as e:\n         return {'status': 'Error', 'message': str(e)}\n\n      return {'status': 'Okay', 'message': 'File Removed...'}\n", "FileObject": "import json\n\nclass FileObject:\n  def __init__(self, metadata={}):\n      assert isinstance(metadata, dict), \"metadata must be a dictionary\"\n      self._metadata=metadata\n\n  def get_attribute(self, name):\n      return self._metadata.get(name, None)\n\n  def set_attribute(self, name, value):\n      self._metadata[name]=value\n\n  def to_json(self):\n      return json.dumps(self._metadata)\n\n  def from_json(self, json_string):\n      self._metadata=json.loads(json_string)\n\n  def get_filename(self):\n      return self._metadata['filename']\n\n  def set_filename(self, filename):\n      self._metadata['filename']=filename\n", "remote_storage_fs": "from browser.local_storage import storage\nimport FileSystemBase\nimport FileObject\n\nimport urllib.request\nimport json\nfrom javascript import console\n\nclass RemoteFileSystem(FileSystemBase.FileSystem):\n  def __init__(self, root, baseURL, token=None):\n      FileSystemBase.FileSystem.__init__(self, root)\n      self._baseURL=baseURL\n      self._token=token\n\n  def set_token(self, token):\n      self._token=token\n\n  def _remote_call(self, data):\n      #console.log(\"remote call\", data)\n      data['token']=self._token   #add in token to call\n      _json=json.dumps({'data': data})\n\n      try:\n        _fp,_url,_headers=urllib.request.urlopen(self._baseURL, _json)\n        return json.loads(_fp.read())   #returns a string (in json format)\n      except:\n        return {'status': 'Error', \n                'message': 'Network connectivity issues'}\n\n  def _list_files(self):\n      \"\"\" returns a list of files this person has on storage,\n          return empty list [] if unsuccessful\n      \"\"\"\n\n      #return json.loads(self._remote_call({'command': 'list_files', 'directory': '/'}))\n      return self._remote_call({'command': 'list_files', 'directory': '/'})\n\n  def _read_file(self, filename):\n      \"\"\" retrieves file from storage, returns fileobj if successful,\n          return None if unsuccessful\n      \"\"\"\n      \n      _json=self._remote_call({'command': 'read_file', 'filename': filename})\n\n      try:\n        _f=FileObject.FileObject()\n        #_f=FileSystemBase.FileObject()\n        _f.from_json(_json['fileobj'])\n        return {'status': 'Okay', 'fileobj': _f}\n      except Exception as e:\n        return {'status': 'Error', 'message': str(e)}\n\n  def _write_file(self, fileobj):\n      \"\"\"saves a file to storage, returns True if save was successful,\n         False, if unsuccessful\n      \"\"\"\n   \n      _fileobj=fileobj.to_json()\n      _res=self._remote_call({'command': 'write_file', 'fileobj': _fileobj})\n      return _res\n      \n\n  def _rm_file(self, filename):\n      \"\"\"removes a file in storage, returns True if delete was successful,\n         False, if unsuccessfull\n      \"\"\"\n\n      _res=self._remote_call({'command': 'rm_file', 'filename': filename})\n      return _res\n\n\nclass GoogleDataStorage(RemoteFileSystem):\n  def __init__(self, root):\n      RemoteFileSystem.__init__(self, root, \"/FS\")\n"}