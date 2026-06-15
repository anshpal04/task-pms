const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db')

dotenv.config();

connectDB();
const app = express()'

//middleware
app.use(cors());
app.use(express.json())  //allows to accept json data in the body

app.get('/', (req, res) => {
  res.send('API is running...');
})

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`server runnin on port:${PORT`);
    });
