const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const multer = require("multer");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Font Upload

// Create Schema and Model
const fileUploadSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, "Upload email Required"],
  },
  date: {
    type: String,
    required: [true, "Upload date Required"],
  },
  fontName: {
    type: String,
    required: [true, "Font name Required"],
  },
  font: {
    type: String,
    required: [true, "Font Required"],
  },
});

const fontUploadModel = mongoose.model("font", fileUploadSchema);

// File Upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const name = file.originalname;
    cb(null, name);
  },
});

const upload = multer({ storage: storage });

// Upload Jwt

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized aaccess" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
    if (error) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.axpgb1h.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const fontCollection = client.db("techCharm").collection("fonts");
    const fontGroupCollection = client.db("techCharm").collection("groups");
    const fontUsers = client.db("techCharm").collection("users");

    // Post Jwt
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // Post Users
    app.post("/users", async (req, res) => {
      const users = res.body;
      const query = { email: users.email };
      const existingUsers = await fontUsers.findOne(query);
      if (existingUsers) {
        return res.send({ message: "Already Exist" });
      } else {
        const result = await fontUsers.insertOne(users);
        res.send(result);
      }
    });

    // Post Font
    app.post(
      "/postFont",
      upload.single("font"),

      async (req, res) => {
        const formData = req.body;
        const date = new Date();
        const todayDate = date.getDate();
        const month = date.getMonth();
        const year = date.getFullYear();
        const fullDate = todayDate + "-" + month + "-" + year;

        const fonts = new fontUploadModel({
          email: formData.email,
          date: fullDate,
          fontName: formData.fontName,
          font: req.file.filename,
        });
        const font = await fontCollection.insertOne(fonts);
        res.send(font);
      }
    );

    // Get All Font
    app.get("/getFonts", async (req, res) => {
      const font = await fontCollection.find().toArray();
      res.send(font);
    });

    // Get with Pagination
    app.get("/getFont", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const itemsPerPage = 6;
      const skip = (page - 1) * itemsPerPage;
      const font = await fontCollection
        .find()
        .skip(skip)
        .limit(itemsPerPage)
        .toArray();

      res.send(font);
    });

    // Get With Email Query
    app.get("/getFontWithEmail", verifyJWT, async (req, res) => {
      const query = req.query.email;
      const email = { email: query };
      const result = await fontCollection.find(email).toArray();
      res.send(result);
    });

    // Delete Item
    app.delete("/deleteFont/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await fontCollection.deleteOne(query);
      res.send(result);
    });

    // Create Group
    app.post("/createFontGroup", async (req, res) => {
      const fonts = req.body;
      const group = await fontGroupCollection.insertOne(fonts);
      res.send(group);
    });

    // Get All Groups
    app.get("/getGroup", async (req, res) => {
      const result = await fontGroupCollection.find().toArray();
      res.send(result);
    });

    // Get Specific Groups
    app.get("/getSpecificGrp", async (req, res) => {
      const group = req.query.group;
      const groups = { groupName: group };
      const result = await fontGroupCollection.find(groups).toArray();
      res.send(result);
    });

    // Delete Group
    app.delete("/deleteGroup/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await fontGroupCollection.deleteOne(query);
      res.send(result);
    });

    // Delete Group Font
    app.delete("/deleteGroupFont", async (req, res) => {
      const id = req.query.id;
      const result = await fontGroupCollection.updateMany(
        {},
        { $pull: { fontId: id } }
      );
      res.send(result);
    });

    // Post Group Font
    app.post("/updateGroupFont", async (req, res) => {
      const groupName = req.query.group;
      if (!groupName) {
        return;
      } else {
        const fontId = req.body;
        const takeFontKey = Object.keys(fontId);
        let fontObjId;
        for (const findObjId of takeFontKey) {
          fontObjId = findObjId;
        }

        const result = await fontGroupCollection.updateOne(
          { groupName: groupName },
          {
            $push: { fontId: fontObjId },
          }
        );
        res.send(result);
      }
    });

    // Search Font With Font Name
    app.get("/searchFont", async (req, res) => {
      const searchTerm = req.query.font;
      console.log(searchTerm);
      const regex = new RegExp(searchTerm, "i");
      const fonts = await fontCollection.find({ fontName: regex }).toArray();
      res.send(fonts);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World");
});
app.listen(port, () => {
  console.log(`Server is running ${port}`);
});
