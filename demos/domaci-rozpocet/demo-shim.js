(() => {
  const PREFIX = 'demo:';  // izolace localStorage pro demo
  const ORIG = {
    getItem: localStorage.getItem.bind(localStorage),
    setItem: localStorage.setItem.bind(localStorage),
    removeItem: localStorage.removeItem.bind(localStorage)
  };
  localStorage.getItem = (k)=>ORIG.getItem(PREFIX+k);
  localStorage.setItem = (k,v)=>ORIG.setItem(PREFIX+k,v);
  localStorage.removeItem = (k)=>ORIG.removeItem(PREFIX+k);
})();
