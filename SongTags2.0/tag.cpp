/*
tag.cpp 2.0
Wyatt Hamabe
*/

#ifndef TAG_CPP
#define TAG_CPP

#include <vector>
#include <utility>
#include <iostream>
#include <iterator>
#include <set>
#include "tag.h"

using namespace std;

bool operator<(const Tag& RHS, const Tag& LHS) {
    return RHS.name < LHS.name;
}
bool operator>(const Tag& RHS, const Tag& LHS) {
    return RHS.name > LHS.name;
}
bool operator==(const Tag& RHS, const Tag& LHS) {
    return RHS.name == LHS.name;
}
ostream& operator<<(ostream& os, const Tag& other) {
    os << other.name << ": " << other.value;
    return os;
}

Tag::Tag() : name(""), value(-1) { 
}
Tag::Tag(string  n, int v) : name(n), value(v) {
}
string Tag::getName() {
    return name;
}
int Tag::getValue() {
    return value;
}


#endif