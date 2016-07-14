interface String {
   startsWith(str): boolean;
   endsWith(str): boolean;
   isEqual(ignoreCase, str): boolean;
   replaceVars(vars): string;
}

String.prototype.startsWith = function (str) {
    return this.slice(0, str.length) == str;
}

String.prototype.endsWith = function (str) {
    return this.slice(-str.length) == str;
}

String.prototype.isEqual = function(ignoreCase, str) {
  var str1 = this;

  if (ignoreCase) {
    str1 = str1.toLowerCase();
      str = str.toLowerCase();      
  }

  return str1 === str;
}