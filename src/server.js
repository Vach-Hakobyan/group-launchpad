const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');

const groupRoutes = require('./routes/groupRoutes');
const googleRoutes = require('./routes/googleRoutes');
const {
    startAnnouncementScheduler
} = require('./services/announcementScheduler');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));


app.use('/api/groups', groupRoutes);
app.use('/auth', googleRoutes);

// First route
app.get('/', (req, res) => {
    res.json({
        message: 'Group Launchpad API is running!'
    });
});

// Server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
     startAnnouncementScheduler();
});
