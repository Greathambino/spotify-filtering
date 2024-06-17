# makeFile 3.0
CXXFLAGS = -std=c++11 -g -Wall -O0 #this is to show warnings

all: testSongs

	./testSongs

testSongs: testSongs.cpp song.cpp songs.cpp

	g++ $(CXXFLAGS) -o testSongs testSongs.cpp song.cpp songs.cpp

clean: 
	rm -f testSongs *.o