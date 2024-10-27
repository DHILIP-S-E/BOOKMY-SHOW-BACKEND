const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const dotenv = require("dotenv").config();
const URL = process.env.DB;

const DB_NAME = "movie_db";
const COLLECTION_NAME = "movies";

app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/movie/get-movies", async (req, res) => {
  try {
    const client = new MongoClient(URL, {});
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);
    const movies = await collection.find({}).toArray();
    await client.close();
    res.json(movies);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

app.get("/movie/:id", async (req, res) => {
  try {
    const id = req.params.id;
    console.log("Received request for movie ID:", id); // Log the requested ID

    // Check if the provided ID is a valid format (as string)
    if (typeof id !== "string" || id.length !== 24) {
      return res.status(400).json({ message: "Invalid movie ID format" });
    }

    const client = await new MongoClient(URL).connect();
    let db = client.db(DB_NAME);
    let dbcollection = await db.collection(COLLECTION_NAME);

    console.log("Querying movie with ID:", id); // Log the query

    // Querying by _id as a string
    let movie = await dbcollection.findOne({ _id: id });
    await client.close();

    if (!movie) {
      return res.status(404).json({ message: "Requested movie is not found" });
    }

    res.json(movie);
  } catch (error) {
    console.error("Error occurred:", error); // Log specific error
    res.status(500).json({ message: error.message || "Something went wrong" }); // Return specific error message
  }
});
app.post("/movie/book-movie", async (req, res) => {
  const bookingRequest = req.body;

  // Log the incoming request
  console.log("Booking Request:", bookingRequest);

  // Validate input
  if (!bookingRequest.movieId || !bookingRequest.showId || !bookingRequest.seats || !bookingRequest.name || !bookingRequest.email || !bookingRequest.phoneNumber) {
      return res.status(400).json({ message: "Some fields are missing" });
  }

  const requestedSeat = parseInt(bookingRequest.seats);
  if (isNaN(requestedSeat) || requestedSeat <= 0) {
      return res.status(400).json({ message: "Invalid seat count" });
  }

  try {
      const id = bookingRequest.movieId;
      console.log("Received request for movie ID:", id); // Log the requested ID
      if (typeof id !== "string" || id.length !== 24) {
          return res.status(400).json({ message: "Invalid movie ID format" });
      }
      const client = await new MongoClient(URL).connect();
      const db = client.db(DB_NAME);
      const collection = db.collection(COLLECTION_NAME);

      // Find the movie
      console.log("Finding movie with ID:", bookingRequest.movieId);
      let movie = await collection.findOne({ _id: id });
      console.log("Found movie:", movie);

      if (!movie) {
          await client.close();
          return res.status(404).json({ message: "Requested movie is not found" });
      }

      // Find the show
      const show = Object.values(movie.shows).flat().find((s) => s.id === bookingRequest.showId);
      console.log("Found show:", show);

      if (!show) {
          await client.close();
          return res.status(404).json({ message: "Show not found" });
      }

      // Check available seats
      if (parseInt(show.seats) < requestedSeat) {
          await client.close();
          return res.status(400).json({ message: "Not enough seats available" });
      }

      // Update seats and add booking
      const updateSeats = parseInt(show.seats) - requestedSeat;
      const date = Object.keys(movie.shows).find((d) => movie.shows[d].some((s) => s.id === bookingRequest.showId));
      const showIndex = movie.shows[date].findIndex((s) => s.id === bookingRequest.showId);
      const userBooking = {
          name: bookingRequest.name,
          email: bookingRequest.email,
          phoneNumber: bookingRequest.phoneNumber,
          seats: bookingRequest.seats
      };

      const updatedResult = await collection.updateOne(
          { _id: id },
          { $set: { [`shows.${date}.${showIndex}.seats`]: updateSeats }, $push: { [`shows.${date}.${showIndex}.bookings`]: userBooking } }
      );

      await client.close();

      if (updatedResult.modifiedCount === 0) {
          return res.status(500).json({ message: "Failed to update" });
      }

      return res.status(200).json({ message: "Booking created successfully" });
  } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Something went wrong" });
  }
});

app.listen(8000, () => {
  console.log("Server is running on port 8000");
});
