# -*- coding: utf-8 -*-

"""
bencode.py - Bencoding/Bdecoding
(c) 2006, 2007, 2008, 2011, 2012, 2013, 2014, 2015 Brian Rosner
Licensed under the MIT license.
"""

# Original: https://github.com/bittorrent/bencode.py

__all__ = ['bencode', 'bdecode']

def bdecode(s):
    """
    Decodes a bencoded string.
    """
    if not isinstance(s, bytes):
        s = s.encode('utf-8')
    
    def decode_func(s, index):
        if s[index:index+1] == b'i':
            end_index = s.find(b'e', index)
            if end_index == -1:
                raise ValueError("Unterminated integer")
            val = int(s[index+1:end_index])
            return val, end_index + 1
        
        elif s[index:index+1] == b'l':
            index += 1
            l = []
            while s[index:index+1] != b'e':
                val, index = decode_func(s, index)
                l.append(val)
            return l, index + 1
            
        elif s[index:index+1] == b'd':
            index += 1
            d = {}
            while s[index:index+1] != b'e':
                key, index = decode_func(s, index)
                val, index = decode_func(s, index)
                d[key] = val
            return d, index + 1
            
        elif s[index:index+1].isdigit():
            colon_index = s.find(b':', index)
            if colon_index == -1:
                raise ValueError("Unterminated string")
            length = int(s[index:colon_index])
            start = colon_index + 1
            end = start + length
            return s[start:end], end
            
        else:
            raise ValueError("Invalid bencode format")

    try:
        decoded, _ = decode_func(s, 0)
        return decoded
    except (IndexError, ValueError):
        raise ValueError("Malformed bencoded string")

def bencode(obj):
    """
    Encodes a Python object to a bencoded string.
    """
    if isinstance(obj, int):
        return b'i' + str(obj).encode('utf-8') + b'e'
    
    elif isinstance(obj, bytes):
        return str(len(obj)).encode('utf-8') + b':' + obj
        
    elif isinstance(obj, str):
        return str(len(obj)).encode('utf-8') + b':' + obj.encode('utf-8')
        
    elif isinstance(obj, list):
        return b'l' + b''.join(bencode(item) for item in obj) + b'e'
        
    elif isinstance(obj, dict):
        # Keys must be bytes and sorted
        if not all(isinstance(k, bytes) for k in obj.keys()):
            raise TypeError("Dictionary keys must be bytes.")
        
        encoded_items = []
        for key in sorted(obj.keys()):
            encoded_items.append(bencode(key))
            encoded_items.append(bencode(obj[key]))
        return b'd' + b''.join(encoded_items) + b'e'
        
    else:
        raise TypeError(f"Objects of type '{type(obj).__name__}' cannot be bencoded.")
