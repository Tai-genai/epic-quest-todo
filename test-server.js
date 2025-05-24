const express = require('express');
const app = express();
const PORT = 9999;

app.get('/', (req, res) => {
  res.send('Hello World! Server is running on port 9999');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Test server running on http://0.0.0.0:${PORT}`);
});
