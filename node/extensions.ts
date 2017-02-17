interface String {
   startsWith(str): boolean;
   endsWith(str: string, pos?: number): boolean;
   isEqual(ignoreCase, str): boolean;
   replaceVars(vars): string;
}

String.prototype.startsWith = function (str) {
    return this.slice(0, str.length) == str;
}

// ES6 compliance polyfill 
if (!String.prototype.endsWith) {
  String.prototype.endsWith = function(searchString, position) {
      var subjectString = this.toString();
      if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
        position = subjectString.length;
      }
      position -= searchString.length;
      var lastIndex = subjectString.lastIndexOf(searchString, position);
      return lastIndex !== -1 && lastIndex === position;
  };
}

String.prototype.isEqual = function(ignoreCase, str) {
  var str1 = this;

  if (ignoreCase) {
    str1 = str1.toLowerCase();
      str = str.toLowerCase();      
  }

  return str1 === str;
}