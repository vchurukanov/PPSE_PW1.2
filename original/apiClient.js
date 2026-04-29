function getData(url, cb) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url);
  xhr.onload = function() {
    if (xhr.status == 200) {
      cb(null, JSON.parse(xhr.responseText));
    } else {
      cb('Error: ' + xhr.status);
    }
  };
  xhr.onerror = function() { cb('Network error'); };
  xhr.send();
}

function postData(url, data, cb) {
  var xhr = new XMLHttpRequest();
  xhr.open('POST', url);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onload = function() {
    if (xhr.status == 200 || xhr.status == 201) {
      cb(null, JSON.parse(xhr.responseText));
    } else {
      cb('Error: ' + xhr.status);
    }
  };
  xhr.send(JSON.stringify(data));
}

module.exports = {
  getData,
  postData,
};
